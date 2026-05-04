/**
 * V.UX.32 — integration tests for the storage-stats endpoint.
 *
 *   1. GET /account/stats without bearer → 401.
 *   2. Fresh user → all zeros + computedAt set.
 *   3. After creating a trip → trips=1; archived=0; itineraryDays=0.
 *
 * Installed by prompt [V.UX.32].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';

const TEST_PREFIX = 'account-stats-e2e';

interface RegisterRes {
  userId: string;
  accessToken: string;
}
interface StatsRes {
  trips: number;
  tripsArchived: number;
  mediaAssets: number;
  reviews: number;
  trustedContacts: number;
  computedAt: string;
}

describe('V.UX.32 storage stats (integration, requires Docker Postgres)', () => {
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
      // eslint-disable-next-line no-console
      console.warn(
        `account-stats: DB not reachable (${err instanceof Error ? err.message : String(err)}). Skipping.`,
      );
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (!dbReachable) return;
    await prisma.trip.deleteMany({
      where: { user: { displayName: { startsWith: TEST_PREFIX } } },
    });
    await prisma.user.deleteMany({ where: { displayName: { startsWith: TEST_PREFIX } } });
  });

  afterAll(async () => {
    if (dbReachable) await app.close();
    await moduleRef.close();
  });

  async function registerAndGetToken(suffix: string): Promise<RegisterRes> {
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
    return JSON.parse(res.body) as RegisterRes;
  }

  it('GET /account/stats without bearer → 401', async () => {
    if (!dbReachable) return;
    const res = await app.inject({ method: 'GET', url: '/api/v1/account/stats' });
    expect(res.statusCode).toBe(401);
  });

  it('Fresh user → all zeros + computedAt populated', async () => {
    if (!dbReachable) return;
    const u = await registerAndGetToken('fresh');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/account/stats',
      headers: { authorization: `Bearer ${u.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as StatsRes;
    expect(body.trips).toBe(0);
    expect(body.tripsArchived).toBe(0);
    expect(body.mediaAssets).toBe(0);
    expect(body.reviews).toBe(0);
    expect(body.trustedContacts).toBe(0);
    expect(body.computedAt).toMatch(/T/);
  });

  it('After creating a trip → trips=1', async () => {
    if (!dbReachable) return;
    const u = await registerAndGetToken('with-trip');
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${u.accessToken}` },
      payload: { title: `${TEST_PREFIX}-trip`, center: { lat: 12.97, lng: 77.59 }, radiusKm: 25 },
    });
    expect(create.statusCode).toBe(201);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/account/stats',
      headers: { authorization: `Bearer ${u.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as StatsRes;
    expect(body.trips).toBe(1);
    expect(body.tripsArchived).toBe(0);
  });
});
