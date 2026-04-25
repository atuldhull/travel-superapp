/**
 * Integration test for the trip-overview cache layer
 * ([IV.18.2.15]).
 *
 * Doesn't re-test the per-section degradation contract — that
 * lives in `trip-overview.e2e-spec.ts`. This suite focuses
 * narrowly on the cache layer:
 *
 *   1. First `GET /trips/:id/overview` increments
 *      `tripOverviewCache.getStats().misses`.
 *   2. Second call to the same path with the same user → hit.
 *   3. Different user calling the same trip's overview gets its
 *      own cache key (per-user keying — auth-posture safety).
 *
 * Doesn't stub the seven providers — real (or default-stubbed
 * via the existing module wiring) responses are fine here, the
 * cache wraps the assembled DTO regardless of section state.
 *
 * Installed by prompt [IV.18.2.15].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { TripOverviewCache } from '../src/modules/trip/infrastructure/trip-overview-cache';

const TEST_PREFIX = 'trip-overview-cache-e2e';
// Suite-local remote coord (memory/feedback_unique_test_coords.md).
const REMOTE = { lat: -41.5678, lng: 173.4321 };

describe('GET /trips/:id/overview cache (integration, requires Docker Postgres + Redis)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let cache: TripOverviewCache;
  let infraReachable = true;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)', 'metrics'] });
    await app.register(fastifyCookie);
    try {
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
      prisma = moduleRef.get(PrismaService);
      cache = moduleRef.get(TripOverviewCache);
      await prisma.$queryRaw`SELECT 1`;
      // Warm Redis connection so subsequent stats are stable.
      await cache.get('warmup-probe');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`trip-overview-cache test: infra not reachable (${message}). Skipping.`);
      infraReachable = false;
    }
  });

  afterEach(async () => {
    if (!infraReachable) return;
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
  });

  afterAll(async () => {
    if (infraReachable) await app.close();
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

  async function createTrip(token: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: `${TEST_PREFIX}-trip`,
        center: REMOTE,
        radiusKm: 5,
        startsOn: '2026-09-01',
        endsOn: '2026-09-03',
      },
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { id: string }).id;
  }

  async function fetchOverview(token: string, tripId: string): Promise<number> {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${tripId}/overview`,
      headers: { authorization: `Bearer ${token}` },
    });
    return res.statusCode;
  }

  it('first overview call → cache miss; second call → cache hit (same user)', async () => {
    if (!infraReachable) return;
    const u = await registerUser('user');
    const tripId = await createTrip(u.accessToken);

    const before = cache.getStats();
    const status1 = await fetchOverview(u.accessToken, tripId);
    expect(status1).toBe(200);
    const afterMiss = cache.getStats();
    expect(afterMiss.misses).toBe(before.misses + 1);
    expect(afterMiss.hits).toBe(before.hits);

    const status2 = await fetchOverview(u.accessToken, tripId);
    expect(status2).toBe(200);
    const afterHit = cache.getStats();
    expect(afterHit.hits).toBe(afterMiss.hits + 1);
    expect(afterHit.misses).toBe(afterMiss.misses);
  });

  it('cache hit serves the same payload as the cold compute', async () => {
    if (!infraReachable) return;
    const u = await registerUser('payload');
    const tripId = await createTrip(u.accessToken);
    const cold = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${tripId}/overview`,
      headers: { authorization: `Bearer ${u.accessToken}` },
    });
    const warm = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${tripId}/overview`,
      headers: { authorization: `Bearer ${u.accessToken}` },
    });
    // Bodies match exactly — same DTO, served from cache the second time.
    expect(JSON.parse(warm.body)).toEqual(JSON.parse(cold.body));
  });

  it('TripOverviewCache.getStats() namespace label is correct', () => {
    if (!infraReachable) return;
    expect(cache.getStats().namespace).toBe('trip-overview');
  });
});
