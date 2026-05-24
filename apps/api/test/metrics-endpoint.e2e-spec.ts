/**
 * Integration test for the Prometheus `/metrics` scrape endpoint
 * ([IV.18.10.6]).
 *
 * Asserts:
 *   - `GET /metrics` is `@Public()` (no JWT required) and returns
 *     200 with text-format prom output.
 *   - `cache_hit_total{cache="trip-balances"}` and
 *     `cache_miss_total{cache="trip-balances"}` lines appear after
 *     the first cache touch.
 *   - The values reflect the running `getStats()` snapshot — a
 *     fresh hit increases `cache_hit_total` between scrapes.
 *   - Default Node process metrics (CPU, memory, event loop) are
 *     surfaced as a smoke-test of `collectDefaultMetrics`.
 *
 * Installed by prompt [IV.18.10.6].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { TripBalancesCache } from '../src/modules/social/infrastructure/trip-balances-cache';
import { uniqueSuffix } from './factories';

describe('GET /metrics (integration, requires Docker Redis)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let cache: TripBalancesCache;
  let infraReachable = true;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    // Match prod main.ts — /metrics stays bare so prom scrapers
    // hit `/metrics` not `/api/v1/metrics`.
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)', 'metrics'] });
    await app.register(fastifyCookie);
    try {
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
      cache = moduleRef.get(TripBalancesCache);
      // Force a connect attempt so the cache namespace label
      // shows up in subsequent scrapes.
      await cache.get('metrics-warmup-probe');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`metrics-endpoint test: infra not reachable (${message}). Skipping.`);
      infraReachable = false;
    }
  });

  afterAll(async () => {
    if (infraReachable) await app.close();
    await moduleRef.close();
  });

  async function scrape(): Promise<{ status: number; body: string; contentType: string }> {
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    return {
      status: res.statusCode,
      body: res.body,
      contentType: res.headers['content-type'] as string,
    };
  }

  function parseGauge(body: string, name: string, label: string): number | null {
    // Match lines of the form: `cache_hit_total{cache="trip-balances"} 7`
    const re = new RegExp(`^${name}\\{cache="${label}"\\}\\s+([\\d.]+)`, 'm');
    const m = body.match(re);
    return m && m[1] !== undefined ? Number(m[1]) : null;
  }

  it('@Public(): no bearer required → 200 + prom text-format', async () => {
    if (!infraReachable) return;
    const { status, body, contentType } = await scrape();
    expect(status).toBe(200);
    expect(contentType).toContain('text/plain');
    // prom-client emits a `# HELP` line for every registered metric.
    expect(body).toContain('# HELP cache_hit_total');
    expect(body).toContain('# HELP cache_miss_total');
  });

  it('emits cache_hit_total + cache_miss_total labeled by cache namespace', async () => {
    if (!infraReachable) return;
    const { body } = await scrape();
    expect(body).toMatch(/cache_hit_total\{cache="trip-balances"\}\s+\d/);
    expect(body).toMatch(/cache_miss_total\{cache="trip-balances"\}\s+\d/);
  });

  it('cache_hit_total reflects new hits between scrapes', async () => {
    if (!infraReachable) return;
    const before = await scrape();
    const beforeHits = parseGauge(before.body, 'cache_hit_total', 'trip-balances') ?? 0;

    // Warm + hit.
    const key = `metrics-test-warm-${uniqueSuffix()}`;
    await cache.set(key, [], 60);
    await cache.get(key);

    const after = await scrape();
    const afterHits = parseGauge(after.body, 'cache_hit_total', 'trip-balances') ?? 0;
    expect(afterHits).toBeGreaterThan(beforeHits);
  });

  it('default node process metrics are surfaced', async () => {
    if (!infraReachable) return;
    const { body } = await scrape();
    // collectDefaultMetrics emits these baseline series.
    expect(body).toContain('process_cpu_user_seconds_total');
    expect(body).toContain('nodejs_eventloop_lag_seconds');
  });
});
