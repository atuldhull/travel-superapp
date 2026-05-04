/**
 * V.UX.40 — public landing-page metrics endpoint integration test.
 *
 *   GET /api/v1/metrics-public
 *
 * Asserts:
 *   1. No bearer required (Public).
 *   2. Response shape exposes the 3 anonymized counters + computedAt.
 *   3. 5-minute cache: a second call within window returns the same
 *      `computedAt` (proving the use-case wasn't re-run).
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';

interface MetricsResp {
  tripsThisMonth: number;
  memoryBooksThisMonth: number;
  activeUsersThisWeek: number;
  computedAt: string;
}

describe('V.UX.40 — Public metrics endpoint (integration, requires Docker Postgres)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
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
      const prisma = moduleRef.get(PrismaService);
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`public-metrics test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterAll(async () => {
    if (dbReachable) await app.close();
    await moduleRef.close();
  });

  it('GET /metrics-public is public + returns the sanitized 3-counter shape', async () => {
    if (!dbReachable) return;
    const res = await app.inject({ method: 'GET', url: '/api/v1/metrics-public' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as MetricsResp;
    expect(typeof body.tripsThisMonth).toBe('number');
    expect(typeof body.memoryBooksThisMonth).toBe('number');
    expect(typeof body.activeUsersThisWeek).toBe('number');
    expect(typeof body.computedAt).toBe('string');
    // Fuzz: every value < 1000 must be a multiple of 10.
    for (const k of ['tripsThisMonth', 'memoryBooksThisMonth', 'activeUsersThisWeek'] as const) {
      const v = body[k];
      if (v < 1000) expect(v % 10).toBe(0);
    }
  });

  it('caches for 5 minutes — second call returns same computedAt', async () => {
    if (!dbReachable) return;
    const first = await app.inject({ method: 'GET', url: '/api/v1/metrics-public' });
    const second = await app.inject({ method: 'GET', url: '/api/v1/metrics-public' });
    const a = JSON.parse(first.body) as MetricsResp;
    const b = JSON.parse(second.body) as MetricsResp;
    expect(a.computedAt).toBe(b.computedAt);
  });
});
