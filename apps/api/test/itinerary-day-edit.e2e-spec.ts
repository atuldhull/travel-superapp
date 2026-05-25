/**
 * Integration tests for [IV.18.2.11] — PATCH
 * /trips/:tripId/itinerary/:dayId. Lets users reorder / remove /
 * add items within a day.
 *
 * Covers:
 *   1. Reorder (same placeIds, new positions) → persisted.
 *   2. Remove items by sending a subset.
 *   3. Add items with new placeIds.
 *   4. Empty items array wipes the day.
 *   5. Day belongs to another user → 404 TRIP_NOT_FOUND.
 *   6. Day belongs to a different trip of the same user → 404
 *      (scoped to the URL's tripId, not just the user).
 *   7. Non-existent placeId → 404 PLACE_NOT_FOUND.
 *   8. > 20 items → 422 (Zod cap).
 *   9. Duplicate positions → 422 DUPLICATE_POSITION.
 *  10. Unauthenticated → 401.
 *
 * Suite-local coord to avoid cross-suite Place contamination (see
 * `memory/feedback_unique_test_coords.md`).
 *
 * Installed by prompt [IV.18.2.11].
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

const SOURCE_PREFIX = 'day-edit-e2e';
// Suite-local trip center (no other suite seeds near this coord).
const CENTER = { lat: -12.3456, lng: 87.6543 };

interface DayResp {
  readonly id: string;
  readonly dayIndex: number;
  readonly items: Array<{
    readonly id: string;
    readonly position: number;
    readonly placeId: string | null;
    readonly notes: string | null;
  }>;
}

describe('PATCH day items (integration, requires Docker Postgres)', () => {
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
      where: { sourceKey: { startsWith: SOURCE_PREFIX } },
    });
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: SOURCE_PREFIX } },
    });
  });

  afterAll(async () => {
    await app.close();
    await moduleRef.close();
  });

  async function registerAndGetToken(suffix: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail(`${SOURCE_PREFIX}-${suffix}`),
        password: 'correct-horse-battery-staple',
        displayName: `${SOURCE_PREFIX}-${suffix}`,
      },
      headers: { 'user-agent': 'day-edit-ua' },
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { accessToken: string }).accessToken;
  }

  async function createTripWithItinerary(
    token: string,
    nPlaces: number,
  ): Promise<{ tripId: string; dayId: string; placeIds: string[] }> {
    const placeIds: string[] = [];
    for (let i = 0; i < nPlaces; i++) {
      const row = await geo.insertPlace({
        sourceKey: `${SOURCE_PREFIX}-p${i}-${uniqueSuffix()}`,
        name: `seed-${i}`,
        category: 'park',
        lat: CENTER.lat + i * 0.0005,
        lng: CENTER.lng,
      });
      placeIds.push(row.id);
    }

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: `${SOURCE_PREFIX}-trip`,
        center: CENTER,
        radiusKm: 5,
        startsOn: '2026-08-01',
        endsOn: '2026-08-01', // 1-day trip → 1 day to edit.
      },
    });
    const tripId = (JSON.parse(create.body) as { id: string }).id;

    const gen = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/itinerary`,
      headers: { authorization: `Bearer ${token}` },
    });
    const dayId = (JSON.parse(gen.body) as { days: [{ id: string }] }).days[0]!.id;

    return { tripId, dayId, placeIds };
  }

  it('reorder: same placeIds with new positions → persisted', async () => {
    const token = await registerAndGetToken('reorder');
    const { tripId, dayId, placeIds } = await createTripWithItinerary(token, 3);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/trips/${tripId}/itinerary/${dayId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        items: [
          { position: 1, placeId: placeIds[2] },
          { position: 2, placeId: placeIds[0] },
          { position: 3, placeId: placeIds[1] },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const day = (JSON.parse(res.body) as { day: DayResp }).day;
    expect(day.items).toHaveLength(3);
    expect(day.items.map((i) => i.placeId)).toEqual([placeIds[2], placeIds[0], placeIds[1]]);
  });

  it('remove: subset leaves only those items', async () => {
    const token = await registerAndGetToken('remove');
    const { tripId, dayId, placeIds } = await createTripWithItinerary(token, 3);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/trips/${tripId}/itinerary/${dayId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { items: [{ position: 1, placeId: placeIds[0] }] },
    });
    expect(res.statusCode).toBe(200);
    const day = (JSON.parse(res.body) as { day: DayResp }).day;
    expect(day.items).toHaveLength(1);
    expect(day.items[0]!.placeId).toBe(placeIds[0]);
  });

  it('add: new placeIds with free-form notes and a null-placeId activity', async () => {
    const token = await registerAndGetToken('add');
    const { tripId, dayId, placeIds } = await createTripWithItinerary(token, 3);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/trips/${tripId}/itinerary/${dayId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        items: [
          { position: 1, placeId: placeIds[0], notes: 'Breakfast here' },
          { position: 2, placeId: null, notes: 'Beach walk (no Place row)' },
          { position: 3, placeId: placeIds[1], notes: null },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const day = (JSON.parse(res.body) as { day: DayResp }).day;
    expect(day.items).toHaveLength(3);
    expect(day.items[0]!.notes).toBe('Breakfast here');
    expect(day.items[1]!.placeId).toBe(null);
    expect(day.items[1]!.notes).toBe('Beach walk (no Place row)');
  });

  it('wipe: empty array leaves the day with no items', async () => {
    const token = await registerAndGetToken('wipe');
    const { tripId, dayId } = await createTripWithItinerary(token, 3);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/trips/${tripId}/itinerary/${dayId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { items: [] },
    });
    expect(res.statusCode).toBe(200);
    const day = (JSON.parse(res.body) as { day: DayResp }).day;
    expect(day.items).toEqual([]);
  });

  it('day belongs to another user → 404 TRIP_NOT_FOUND', async () => {
    const aliceToken = await registerAndGetToken('alice');
    const bobToken = await registerAndGetToken('bob');
    const { tripId, dayId, placeIds } = await createTripWithItinerary(aliceToken, 1);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/trips/${tripId}/itinerary/${dayId}`,
      headers: { authorization: `Bearer ${bobToken}` },
      payload: { items: [{ position: 1, placeId: placeIds[0] }] },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('TRIP_NOT_FOUND');
  });

  it('day belongs to a different trip of the same user → 404', async () => {
    const token = await registerAndGetToken('wrong-trip');
    const trip1 = await createTripWithItinerary(token, 1);
    const trip2 = await createTripWithItinerary(token, 1);

    // Submit trip1's dayId under trip2's tripId.
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/trips/${trip2.tripId}/itinerary/${trip1.dayId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { items: [] },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('TRIP_NOT_FOUND');
  });

  it('non-existent placeId → 404 PLACE_NOT_FOUND', async () => {
    const token = await registerAndGetToken('bad-place');
    const { tripId, dayId } = await createTripWithItinerary(token, 1);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/trips/${tripId}/itinerary/${dayId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        items: [{ position: 1, placeId: '00000000-0000-4000-8000-000000000000' }],
      },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('PLACE_NOT_FOUND');
  });

  it('duplicate positions → 422 DUPLICATE_POSITION', async () => {
    const token = await registerAndGetToken('dup-pos');
    const { tripId, dayId, placeIds } = await createTripWithItinerary(token, 2);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/trips/${tripId}/itinerary/${dayId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        items: [
          { position: 1, placeId: placeIds[0] },
          { position: 1, placeId: placeIds[1] },
        ],
      },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('DUPLICATE_POSITION');
  });

  it('> 20 items → 422 VALIDATION_FAILED (Zod cap)', async () => {
    const token = await registerAndGetToken('too-many');
    const { tripId, dayId } = await createTripWithItinerary(token, 1);
    const items = Array.from({ length: 21 }, (_, i) => ({ position: i + 1, placeId: null }));
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/trips/${tripId}/itinerary/${dayId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { items },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });

  it('unauthenticated → 401 UNAUTHENTICATED', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/trips/fake-trip/itinerary/fake-day',
      payload: { items: [] },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });
});
