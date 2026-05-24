/**
 * Integration tests for `POST /api/v1/trips/:id/itinerary/shift`
 * (Phase 3, G4). Owner-gated; bounded ±365 days at the zod gate.
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'g4-shift-e2e';
const REMOTE = { lat: 22.2222, lng: -22.2222 };

describe('Trip × itinerary shift (G4, integration)', () => {
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
      console.warn(`g4-shift test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (dbReachable) {
      await prisma.user.deleteMany({ where: { displayName: { startsWith: TEST_PREFIX } } });
    }
  });

  afterAll(async () => {
    if (dbReachable) await app.close();
    await moduleRef.close();
  });

  async function registerUser(suffix: string): Promise<{ accessToken: string }> {
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
    return JSON.parse(res.body) as { accessToken: string };
  }

  async function createTripWithDays(
    accessToken: string,
  ): Promise<{ tripId: string; dayDates: string[] }> {
    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: 'g4 trip',
        center: REMOTE,
        radiusKm: 5,
        startsOn: new Date('2026-08-01T00:00:00Z').toISOString(),
        endsOn: new Date('2026-08-03T00:00:00Z').toISOString(),
      },
    });
    expect(tripRes.statusCode).toBe(201);
    const tripId = (JSON.parse(tripRes.body) as { id: string }).id;

    const genRes = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/itinerary`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect([200, 201]).toContain(genRes.statusCode);

    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${tripId}/itinerary`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(list.statusCode).toBe(200);
    const days = (JSON.parse(list.body) as { days: Array<{ date: string }> }).days;
    expect(days.length).toBeGreaterThan(0);
    return { tripId, dayDates: days.map((d) => d.date) };
  }

  it('shifts every day forward by 7 days and returns the row count', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('shift');
    const { tripId, dayDates } = await createTripWithDays(accessToken);

    const shiftRes = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/itinerary/shift`,
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      payload: { deltaDays: 7 },
    });
    expect(shiftRes.statusCode).toBe(200);
    const body = JSON.parse(shiftRes.body) as { shifted: number };
    expect(body.shifted).toBe(dayDates.length);

    // Verify each day shifted by exactly +7 days.
    const after = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${tripId}/itinerary`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const newDates = (JSON.parse(after.body) as { days: Array<{ date: string }> }).days.map(
      (d) => d.date,
    );
    expect(newDates.length).toBe(dayDates.length);
    for (let i = 0; i < dayDates.length; i += 1) {
      const before = new Date(dayDates[i]!).getTime();
      const next = new Date(newDates[i]!).getTime();
      const deltaDays = Math.round((next - before) / 86_400_000);
      expect(deltaDays).toBe(7);
    }
  });

  it('deltaDays=0 is a no-op (shifted=0)', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('noop');
    const { tripId } = await createTripWithDays(accessToken);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/itinerary/shift`,
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      payload: { deltaDays: 0 },
    });
    expect(res.statusCode).toBe(200);
    expect((JSON.parse(res.body) as { shifted: number }).shifted).toBe(0);
  });

  it('422 INVALID_INPUT when deltaDays > 365', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('range');
    const { tripId } = await createTripWithDays(accessToken);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/itinerary/shift`,
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      payload: { deltaDays: 9999 },
    });
    expect(res.statusCode).toBe(422);
  });

  it('IDOR: non-owner → 404 TRIP_NOT_FOUND', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');
    const { tripId } = await createTripWithDays(alice.accessToken);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/itinerary/shift`,
      headers: { authorization: `Bearer ${bob.accessToken}`, 'content-type': 'application/json' },
      payload: { deltaDays: 3 },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('TRIP_NOT_FOUND');
  });

  it('unauthenticated → 401', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips/whatever/itinerary/shift',
      headers: { 'content-type': 'application/json' },
      payload: { deltaDays: 1 },
    });
    expect(res.statusCode).toBe(401);
  });
});
