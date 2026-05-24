/**
 * Integration tests for [IV.18.2.4] itinerary stub.
 *
 * Verifies:
 *   1. POST /trips/:id/itinerary on a trip with startsOn + endsOn →
 *      200, returns days of the correct length + dayIndex 1..N.
 *   2. Without startsOn/endsOn → 422 ITINERARY_DATES_REQUIRED.
 *   3. Another user's trip → 404 TRIP_NOT_FOUND (IDOR defence).
 *   4. Re-running the generator wipes + re-creates (no duplicate rows).
 *   5. GET /trips/:id/itinerary echoes the stored days after generation.
 *   6. Trip length > 90 days → 422 TRIP_TOO_LONG.
 *
 * Installed by prompt [IV.18.2.4].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'itin-e2e';
// Unique coordinate for this suite — "middle of the Pacific"
// — so cross-suite Place seeding near populated cities (Victoria
// / places-e2e / geo-queries) can't contaminate the generator's
// place lookup. The radius-5km search here will find nothing
// unless THIS suite seeds, which it doesn't.
const VICTORIA = { lat: 12.3456, lng: -150.7891 };

describe('Trip itinerary stub (integration, requires Docker Postgres)', () => {
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
      console.warn(`itinerary test: DB not reachable (${message}). Skipping.`);
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
    if (dbReachable) {
      await app.close();
    }
    await moduleRef.close();
  });

  async function registerUser(suffix: string): Promise<{
    userId: string;
    accessToken: string;
  }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail(`${TEST_PREFIX}-${suffix}`),
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-${suffix}`,
      },
      headers: { 'user-agent': 'itin-ua' },
    });
    expect(res.statusCode).toBe(201);
    return JSON.parse(res.body) as { userId: string; accessToken: string };
  }

  async function createTrip(
    accessToken: string,
    payload: {
      title: string;
      radiusKm?: number;
      startsOn?: string;
      endsOn?: string;
    },
  ): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: payload.title,
        center: VICTORIA,
        radiusKm: payload.radiusKm ?? 5,
        ...(payload.startsOn ? { startsOn: payload.startsOn } : {}),
        ...(payload.endsOn ? { endsOn: payload.endsOn } : {}),
      },
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { id: string }).id;
  }

  it('POST /trips/:id/itinerary returns one day per date, numbered 1..N', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('happy');
    const tripId = await createTrip(accessToken, {
      title: 'London 3-day',
      startsOn: '2026-08-01',
      endsOn: '2026-08-03',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/itinerary`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      days: Array<{ dayIndex: number; tripId: string; summary: string | null; date: string }>;
    };
    expect(body.days).toHaveLength(3);
    expect(body.days.map((d) => d.dayIndex)).toEqual([1, 2, 3]);
    expect(body.days.every((d) => d.tripId === tripId)).toBe(true);
    expect(body.days[0]!.summary).toContain('Day 1');
    expect(body.days[0]!.date.startsWith('2026-08-01')).toBe(true);
    expect(body.days[2]!.date.startsWith('2026-08-03')).toBe(true);

    // DB holds exactly 3 rows.
    const rowCount = await prisma.itineraryDay.count({ where: { tripId } });
    expect(rowCount).toBe(3);
  });

  it('trip without startsOn + endsOn → 422 ITINERARY_DATES_REQUIRED', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('no-dates');
    const tripId = await createTrip(accessToken, { title: 'undated' });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/itinerary`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('ITINERARY_DATES_REQUIRED');
  });

  it("another user's trip → 404 TRIP_NOT_FOUND", async () => {
    if (!dbReachable) return;
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');
    const tripId = await createTrip(alice.accessToken, {
      title: 'alice trip',
      startsOn: '2026-09-01',
      endsOn: '2026-09-02',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/itinerary`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('TRIP_NOT_FOUND');
  });

  it('re-generating wipes + re-creates without duplicate rows', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('replan');
    const tripId = await createTrip(accessToken, {
      title: 'replan',
      startsOn: '2026-08-01',
      endsOn: '2026-08-05',
    });

    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/trips/${tripId}/itinerary`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.statusCode).toBe(200);
    }
    const count = await prisma.itineraryDay.count({ where: { tripId } });
    expect(count).toBe(5); // Not 15 — each call wipes + re-inserts.
  });

  it('GET /trips/:id/itinerary returns the generated days', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('read');
    const tripId = await createTrip(accessToken, {
      title: 'read-back',
      startsOn: '2026-08-01',
      endsOn: '2026-08-02',
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/itinerary`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const read = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${tripId}/itinerary`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(read.statusCode).toBe(200);
    const body = JSON.parse(read.body) as { days: Array<{ dayIndex: number }> };
    expect(body.days.map((d) => d.dayIndex)).toEqual([1, 2]);
  });

  it('trip length > 90 days → 422 TRIP_TOO_LONG', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('toolong');
    const tripId = await createTrip(accessToken, {
      title: 'sabbatical',
      startsOn: '2026-01-01',
      endsOn: '2026-06-30', // ~181 days.
    });
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/itinerary`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('TRIP_TOO_LONG');
  });

  it('unauthenticated → 401 UNAUTHENTICATED', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips/some-id/itinerary',
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });
});
