/**
 * Integration tests for `GET /reviews/summary` ([IV.18.12.8]).
 *
 * Aggregated review summary `{ targetType, targetId, count, average,
 * histogram }`. `@Public()` — no auth required (review summaries are
 * crowd signal, not PII).
 *
 *   - Empty target → 200 with zero-filled shape (NOT 404).
 *   - 5 reviews of varying ratings → correct count + average +
 *     per-bucket counts.
 *   - Cross-target isolation: reviews on `place:A` don't leak into
 *     `place:B`'s summary.
 *   - 422-equivalent for missing / unknown targetType.
 *   - No bearer required.
 *
 * Installed by prompt [IV.18.12.8].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';

const TEST_PREFIX = 'review-summary-e2e';

interface SummaryBody {
  targetType: string;
  targetId: string;
  count: number;
  average: number;
  histogram: Record<string, number>;
}

describe('GET /reviews/summary (integration, requires Docker Postgres)', () => {
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
      console.warn(`review-summary test: DB not reachable (${message}). Skipping.`);
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

  async function postReview(
    token: string,
    targetId: string,
    rating: number,
    body = 'Decent visit, nothing to write home about.',
  ): Promise<void> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reviews',
      headers: { authorization: `Bearer ${token}` },
      payload: { targetType: 'place', targetId, rating, body },
    });
    expect(res.statusCode).toBe(201);
  }

  async function getSummary(targetId: string): Promise<{ status: number; body: SummaryBody }> {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/reviews/summary?targetType=place&targetId=${encodeURIComponent(targetId)}`,
    });
    return { status: res.statusCode, body: JSON.parse(res.body) as SummaryBody };
  }

  it('empty target → 200 with zero-filled shape (no 404)', async () => {
    if (!dbReachable) return;
    // Suite-local id keeps parallel runs independent.
    const targetId = `${TEST_PREFIX}-empty-${Date.now()}`;
    const { status, body } = await getSummary(targetId);
    expect(status).toBe(200);
    expect(body.targetType).toBe('place');
    expect(body.targetId).toBe(targetId);
    expect(body.count).toBe(0);
    expect(body.average).toBe(0);
    expect(body.histogram).toEqual({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 });
  });

  it('5 reviews of varying ratings → correct count + average + histogram', async () => {
    if (!dbReachable) return;
    const targetId = `${TEST_PREFIX}-rich-${Date.now()}`;
    // Three different authors so unique-key constraints (if any) don't bite.
    // Ratings: 5,5,4,3,1 → average 3.6.
    const a = await registerUser('a');
    const b = await registerUser('b');
    const c = await registerUser('c');
    await postReview(a.accessToken, targetId, 5);
    await postReview(b.accessToken, targetId, 5);
    await postReview(c.accessToken, targetId, 4);
    await postReview(a.accessToken, targetId, 3, 'Second visit was less great.');
    await postReview(b.accessToken, targetId, 1, 'Worse the second time around.');

    const { status, body } = await getSummary(targetId);
    expect(status).toBe(200);
    expect(body.count).toBe(5);
    expect(body.average).toBe(3.6);
    expect(body.histogram).toEqual({ '1': 1, '2': 0, '3': 1, '4': 1, '5': 2 });
  });

  it('cross-target isolation: A’s reviews do not leak into B’s summary', async () => {
    if (!dbReachable) return;
    const targetA = `${TEST_PREFIX}-A-${Date.now()}`;
    const targetB = `${TEST_PREFIX}-B-${Date.now()}`;
    const u = await registerUser('iso');
    await postReview(u.accessToken, targetA, 5);
    await postReview(u.accessToken, targetA, 4);

    const a = await getSummary(targetA);
    expect(a.body.count).toBe(2);
    const bSum = await getSummary(targetB);
    expect(bSum.body.count).toBe(0);
    expect(bSum.body.histogram).toEqual({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 });
  });

  it('missing query params → 400 VALIDATION_FAILED', async () => {
    if (!dbReachable) return;
    const res = await app.inject({ method: 'GET', url: '/api/v1/reviews/summary' });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });

  it('unknown targetType → 400 VALIDATION_FAILED', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reviews/summary?targetType=bogus&targetId=x',
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });

  it('@Public(): no bearer required', async () => {
    if (!dbReachable) return;
    const targetId = `${TEST_PREFIX}-public-${Date.now()}`;
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/reviews/summary?targetType=place&targetId=${targetId}`,
    });
    // No 401 — must be 200 even without auth.
    expect(res.statusCode).toBe(200);
  });
});
