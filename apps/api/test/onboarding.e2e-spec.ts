/**
 * Integration tests for the V.UX.3 onboarding surface.
 *
 * Covers:
 *   1. Fresh registration → /auth/me reports hasSeenOnboarding=false.
 *   2. POST /auth/onboarding/complete with empty body → flag flips,
 *      no Sample trip seeded.
 *   3. POST /auth/onboarding/complete with `{seedSample: true}` →
 *      flag flips AND a "Sample trip — Goa weekend" appears in
 *      /trips. Idempotent: a second call doesn't double-seed.
 *   4. Skip flow on a user who already has trips → flag flips, NO
 *      additional sample seeded (idempotent guard).
 *   5. Unauthenticated POST → 401.
 *
 * Installed by prompt [V.UX.3].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { SAMPLE_TRIP_TITLE_PREFIX } from '../src/modules/trip/application/seed-sample-trip.use-case';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'onboarding-e2e';

describe('Onboarding flow (integration, requires Docker Postgres)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await app.register(fastifyCookie);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = moduleRef.get(PrismaService);
    await prisma.$queryRaw`SELECT 1`;
  });

  afterEach(async () => {
    // Trips first (FK to User), then users.
    await prisma.trip.deleteMany({
      where: { user: { displayName: { startsWith: TEST_PREFIX } } },
    });
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

  async function whoami(accessToken: string): Promise<{
    sub: string;
    sid: string;
    role: string;
    hasSeenOnboarding: boolean;
  }> {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    return JSON.parse(res.body);
  }

  async function listTrips(
    accessToken: string,
  ): Promise<{ trips: Array<{ id: string; title: string }> }> {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    return JSON.parse(res.body);
  }

  it('fresh user → whoami.hasSeenOnboarding=false', async () => {
    const { accessToken } = await registerUser('fresh');
    const me = await whoami(accessToken);
    expect(me.hasSeenOnboarding).toBe(false);
  });

  it('onboarding/complete with empty body → flag flips, NO sample seeded', async () => {
    const { accessToken } = await registerUser('flag-only');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboarding/complete',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: 'ok' });

    const me = await whoami(accessToken);
    expect(me.hasSeenOnboarding).toBe(true);

    const trips = await listTrips(accessToken);
    expect(trips.trips.length).toBe(0);
  });

  it('onboarding/complete with seedSample=true → seeds a Sample trip; idempotent on re-call', async () => {
    const { accessToken } = await registerUser('seed');
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboarding/complete',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { seedSample: true },
    });
    expect(first.statusCode).toBe(200);

    const trips = await listTrips(accessToken);
    expect(trips.trips.length).toBe(1);
    expect(trips.trips[0]!.title.startsWith(SAMPLE_TRIP_TITLE_PREFIX)).toBe(true);

    // Idempotent: a second call should NOT double-seed even with seedSample=true.
    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboarding/complete',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { seedSample: true },
    });
    expect(second.statusCode).toBe(200);
    const tripsAgain = await listTrips(accessToken);
    expect(tripsAgain.trips.length).toBe(1);
  });

  it('user with existing trips + seedSample=true → flag flips, no extra trip', async () => {
    const { accessToken } = await registerUser('has-trip');
    // Create a real trip first.
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { title: 'My real trip', center: { lat: 35.6762, lng: 139.6503 }, radiusKm: 30 },
    });
    expect(create.statusCode).toBe(201);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboarding/complete',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { seedSample: true },
    });
    expect(res.statusCode).toBe(200);

    const trips = await listTrips(accessToken);
    expect(trips.trips.length).toBe(1);
    expect(trips.trips[0]!.title).toBe('My real trip');
  });

  it('unauthenticated → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboarding/complete',
      payload: {},
    });
    expect(res.statusCode).toBe(401);
  });
});
