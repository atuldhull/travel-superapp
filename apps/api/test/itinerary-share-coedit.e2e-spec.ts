/**
 * Integration tests for trip-share co-edit ([IV.18.2.14]).
 *
 * `PATCH /api/v1/trips/:tripId/itinerary/:dayId` was owner-only;
 * now it accepts edits from any authed caller when the trip has
 * an active TripShare. Same gate Social's voting + expenses +
 * reviews use (`assertCanVote`).
 *
 *   1. Owner can still PATCH (no regression — covered by the
 *      existing day-edit suite, but verified end-to-end here too).
 *   2. Non-owner with a trip that HAS an active share → 200.
 *   3. Non-owner with a trip that has NO active share → 404
 *      `TRIP_NOT_FOUND`.
 *   4. Non-owner trying to PATCH a day that belongs to a
 *      different trip (even when the URL's tripId is share-
 *      enabled) → 404 `TRIP_NOT_FOUND` (cross-trip dayId leak
 *      defence).
 *   5. Unauthenticated → 401.
 *
 * Installed by prompt [IV.18.2.14].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';

const TEST_PREFIX = 'itin-share-coedit-e2e';
const COORD = { lat: 47.6062, lng: -122.3321 };

describe('Itinerary share co-edit (integration, requires Docker Postgres)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let dbReachable = true;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await app.register(fastifyCookie);
    try {
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
      prisma = moduleRef.get(PrismaService);
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`itin-share-coedit test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (!dbReachable) return;
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
  });

  afterAll(async () => {
    if (dbReachable) await app.close();
    await moduleRef.close();
  });

  async function registerUser(suffix: string): Promise<{ userId: string; accessToken: string }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `${TEST_PREFIX}-${suffix}-${Date.now()}@example.com`,
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-${suffix}`,
      },
    });
    expect(res.statusCode).toBe(201);
    return JSON.parse(res.body) as { userId: string; accessToken: string };
  }

  async function createTripWithItinerary(
    token: string,
  ): Promise<{ tripId: string; dayId: string }> {
    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: `${TEST_PREFIX}-trip`,
        center: COORD,
        radiusKm: 5,
        startsOn: '2026-09-01',
        endsOn: '2026-09-01',
      },
    });
    expect(tripRes.statusCode).toBe(201);
    const tripId = (JSON.parse(tripRes.body) as { id: string }).id;
    const itinRes = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/itinerary`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(itinRes.statusCode).toBe(200);
    const dayId = (JSON.parse(itinRes.body) as { days: [{ id: string }] }).days[0]!.id;
    return { tripId, dayId };
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

  async function patchDay(
    token: string,
    tripId: string,
    dayId: string,
  ): Promise<{ status: number; body: { code?: string } }> {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/trips/${tripId}/itinerary/${dayId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { items: [{ position: 1, notes: 'collab edit' }] },
    });
    return { status: res.statusCode, body: JSON.parse(res.body) as { code?: string } };
  }

  it('owner can still PATCH their own day (regression)', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('owner-regress');
    const { tripId, dayId } = await createTripWithItinerary(alice.accessToken);

    const { status } = await patchDay(alice.accessToken, tripId, dayId);
    expect(status).toBe(200);
  });

  it('non-owner with active share → 200 (collab edit allowed)', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');
    const { tripId, dayId } = await createTripWithItinerary(alice.accessToken);
    await mintShare(alice.accessToken, tripId);

    // Bob doesn't own the trip + isn't asked to resolve the share
    // code first — the gate is "trip has an active share" (parity
    // with assertCanVote).
    const { status } = await patchDay(bob.accessToken, tripId, dayId);
    expect(status).toBe(200);
  });

  it('non-owner with NO active share → 404 TRIP_NOT_FOUND', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('owner-noshare');
    const bob = await registerUser('stranger');
    const { tripId, dayId } = await createTripWithItinerary(alice.accessToken);
    // No mintShare here — Bob has no path in.

    const { status, body } = await patchDay(bob.accessToken, tripId, dayId);
    expect(status).toBe(404);
    expect(body.code).toBe('TRIP_NOT_FOUND');
  });

  it('cross-trip dayId leak defence: dayId belongs to a different trip → 404', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('alice-cross');
    const bob = await registerUser('bob-cross');
    // Alice creates two trips. trip A has a share (Bob can co-edit
    // its days). trip B has NO share (Bob has no access).
    const a = await createTripWithItinerary(alice.accessToken);
    const b = await createTripWithItinerary(alice.accessToken);
    await mintShare(alice.accessToken, a.tripId);
    // Bob tries to PATCH trip A's URL but with trip B's dayId.
    // The collab gate passes (trip A has a share) — but the day
    // lookup must reject because day.tripId !== URL tripId.
    const { status, body } = await patchDay(bob.accessToken, a.tripId, b.dayId);
    expect(status).toBe(404);
    expect(body.code).toBe('TRIP_NOT_FOUND');
  });

  it('PATCH without bearer → 401', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/trips/some-trip/itinerary/some-day',
      payload: { items: [] },
    });
    expect(res.statusCode).toBe(401);
  });
});
