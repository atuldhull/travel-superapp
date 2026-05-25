/**
 * Integration tests for the Social voting surface ([IV.18.12.3]).
 *
 *   POST   /trips/:tripId/votes        body: { targetType, targetId, value }
 *   DELETE /trips/:tripId/votes        body: { targetType, targetId }
 *   GET    /trips/:tripId/votes        → aggregated tallies + mine
 *
 * Auth gate: caller owns the trip OR the trip has an active
 * published share. Both branches are verified end-to-end here.
 *
 * Installed by prompt [IV.18.12.3].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { GeoQueries } from '../src/common/db/geo-queries';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail, uniqueSuffix } from './factories';

const TEST_PREFIX = 'social-votes-e2e';
const CENTER = { lat: 34.5678, lng: 123.4567 };

interface TallyResp {
  readonly targetType: string;
  readonly targetId: string;
  readonly up: number;
  readonly meh: number;
  readonly down: number;
  readonly score: number;
  readonly mine: number | null;
}

describe('Social votes (integration, requires Postgres)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let geo: GeoQueries;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await app.register(fastifyCookie);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = moduleRef.get(PrismaService);
    geo = moduleRef.get(GeoQueries);
    await prisma.$queryRaw`SELECT 1`;
  });

  afterEach(async () => {
    await prisma.place.deleteMany({
      where: { sourceKey: { startsWith: TEST_PREFIX } },
    });
    // User cascade-deletes Trip + TripShare + Vote rows.
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
  });

  afterAll(async () => {
    await app.close();
    await moduleRef.close();
  });

  async function registerUser(suffix: string): Promise<{ userId: string; accessToken: string }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail(`${TEST_PREFIX}-${suffix}`),
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-${suffix}`,
      },
    });
    expect(res.statusCode).toBe(201);
    return JSON.parse(res.body) as { userId: string; accessToken: string };
  }

  async function createTripWithItem(
    token: string,
  ): Promise<{ tripId: string; dayId: string; itemId: string; placeId: string }> {
    // Seed a Place so the itinerary item has something to point to.
    const place = await geo.insertPlace({
      sourceKey: `${TEST_PREFIX}-place-${uniqueSuffix()}`,
      name: `${TEST_PREFIX}-place`,
      category: 'museum',
      lat: CENTER.lat,
      lng: CENTER.lng,
    });
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: `${TEST_PREFIX}-trip`,
        center: CENTER,
        radiusKm: 5,
        startsOn: '2026-09-01',
        endsOn: '2026-09-01',
      },
    });
    const tripId = (JSON.parse(create.body) as { id: string }).id;

    const gen = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/itinerary`,
      headers: { authorization: `Bearer ${token}` },
    });
    const dayId = (JSON.parse(gen.body) as { days: [{ id: string }] }).days[0]!.id;

    // PATCH the day to add an itinerary item with the place.
    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/trips/${tripId}/itinerary/${dayId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { items: [{ position: 1, placeId: place.id }] },
    });
    const itemId = (JSON.parse(patch.body) as { day: { items: [{ id: string }] } }).day.items[0]!
      .id;

    return { tripId, dayId, itemId, placeId: place.id };
  }

  async function mintShare(token: string, tripId: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/share`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { shareCode: string }).shareCode;
  }

  it('POST /trips/:tripId/votes without a bearer → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips/some-trip/votes',
      payload: { targetType: 'itinerary_item', targetId: 'x', value: 1 },
    });
    expect(res.statusCode).toBe(401);
  });

  it('owner can cast a vote; GET shows it with mine populated', async () => {
    const owner = await registerUser('owner');
    const { tripId, itemId } = await createTripWithItem(owner.accessToken);

    const cast = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/votes`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { targetType: 'itinerary_item', targetId: itemId, value: 1 },
    });
    expect(cast.statusCode).toBe(200);
    expect(JSON.parse(cast.body).value).toBe(1);

    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${tripId}/votes`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(list.statusCode).toBe(200);
    const body = JSON.parse(list.body) as { tallies: TallyResp[] };
    const t = body.tallies.find((t) => t.targetId === itemId);
    expect(t).toBeDefined();
    expect(t!.up).toBe(1);
    expect(t!.down).toBe(0);
    expect(t!.score).toBe(1);
    expect(t!.mine).toBe(1);
  });

  it('non-owner cannot vote on a trip that has no active share → 404', async () => {
    const owner = await registerUser('o-closed');
    const stranger = await registerUser('s-closed');
    const { tripId, itemId } = await createTripWithItem(owner.accessToken);

    const cast = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/votes`,
      headers: { authorization: `Bearer ${stranger.accessToken}` },
      payload: { targetType: 'itinerary_item', targetId: itemId, value: 1 },
    });
    expect(cast.statusCode).toBe(404);
    expect(JSON.parse(cast.body).code).toBe('TRIP_NOT_FOUND');
  });

  it('non-owner CAN vote once the trip has an active share', async () => {
    const owner = await registerUser('o-open');
    const collaborator = await registerUser('collab');
    const { tripId, itemId } = await createTripWithItem(owner.accessToken);

    // Owner publishes a share → opens the trip to voting.
    await mintShare(owner.accessToken, tripId);

    const cast = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/votes`,
      headers: { authorization: `Bearer ${collaborator.accessToken}` },
      payload: { targetType: 'itinerary_item', targetId: itemId, value: 1 },
    });
    expect(cast.statusCode).toBe(200);

    // Owner also votes (thumbs-down) + checks the aggregate.
    await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/votes`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { targetType: 'itinerary_item', targetId: itemId, value: -1 },
    });

    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${tripId}/votes`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    const body = JSON.parse(list.body) as { tallies: TallyResp[] };
    const t = body.tallies.find((x) => x.targetId === itemId)!;
    expect(t.up).toBe(1);
    expect(t.down).toBe(1);
    expect(t.score).toBe(0);
    // Owner's view of `mine` shows their own -1, not the collaborator's +1.
    expect(t.mine).toBe(-1);
  });

  it('recasting a vote (upsert) replaces the value in place, not a new row', async () => {
    const owner = await registerUser('recast');
    const { tripId, itemId } = await createTripWithItem(owner.accessToken);

    await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/votes`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { targetType: 'itinerary_item', targetId: itemId, value: 1 },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/votes`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { targetType: 'itinerary_item', targetId: itemId, value: -1 },
    });

    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${tripId}/votes`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    const body = JSON.parse(list.body) as { tallies: TallyResp[] };
    const t = body.tallies.find((x) => x.targetId === itemId)!;
    // Only one row — up count never goes to 1 + 1.
    expect(t.up).toBe(0);
    expect(t.down).toBe(1);
    expect(t.mine).toBe(-1);
  });

  it('DELETE removes the caller’s vote; subsequent GET no longer shows mine', async () => {
    const owner = await registerUser('revoke');
    const { tripId, itemId } = await createTripWithItem(owner.accessToken);

    await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/votes`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { targetType: 'itinerary_item', targetId: itemId, value: 1 },
    });
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/trips/${tripId}/votes`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { targetType: 'itinerary_item', targetId: itemId },
    });
    expect(del.statusCode).toBe(204);

    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${tripId}/votes`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    const body = JSON.parse(list.body) as { tallies: TallyResp[] };
    // No votes left → the tally is absent entirely.
    expect(body.tallies.find((x) => x.targetId === itemId)).toBeUndefined();
  });

  it('DELETE a vote that never existed → 404 VOTE_NOT_FOUND', async () => {
    const owner = await registerUser('del-missing');
    const { tripId, itemId } = await createTripWithItem(owner.accessToken);

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/trips/${tripId}/votes`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { targetType: 'itinerary_item', targetId: itemId },
    });
    expect(del.statusCode).toBe(404);
    expect(JSON.parse(del.body).code).toBe('VOTE_NOT_FOUND');
  });

  it('revoking the trip share closes voting for non-owners', async () => {
    const owner = await registerUser('o-rev');
    const collaborator = await registerUser('c-rev');
    const { tripId, itemId } = await createTripWithItem(owner.accessToken);
    const shareCode = await mintShare(owner.accessToken, tripId);

    // Collaborator votes while the share is active.
    const ok = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/votes`,
      headers: { authorization: `Bearer ${collaborator.accessToken}` },
      payload: { targetType: 'itinerary_item', targetId: itemId, value: 1 },
    });
    expect(ok.statusCode).toBe(200);

    // Owner revokes the share.
    await app.inject({
      method: 'DELETE',
      url: `/api/v1/trips/${tripId}/share/${shareCode}`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });

    // Collaborator tries to change their vote → 404 now.
    const gated = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/votes`,
      headers: { authorization: `Bearer ${collaborator.accessToken}` },
      payload: { targetType: 'itinerary_item', targetId: itemId, value: -1 },
    });
    expect(gated.statusCode).toBe(404);
    expect(JSON.parse(gated.body).code).toBe('TRIP_NOT_FOUND');
  });

  it('invalid value (e.g. 2) → 422 VALIDATION_FAILED', async () => {
    const owner = await registerUser('bad-value');
    const { tripId, itemId } = await createTripWithItem(owner.accessToken);
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/votes`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { targetType: 'itinerary_item', targetId: itemId, value: 2 },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });
});
