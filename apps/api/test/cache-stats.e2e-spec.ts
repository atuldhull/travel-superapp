/**
 * Integration test for `TypedRedisCache.getStats()` ([IV.18.10.5]).
 *
 * Exercises the new per-instance hit/miss counters against a
 * real Redis instance via the already-wired `TripBalancesCache`.
 * Two assertions:
 *
 *   1. A cold get on an unknown key increments `misses`.
 *   2. A subsequent `set` + `get` on the same key increments
 *      `hits` (and not `misses`).
 *
 * No `/metrics` HTTP route is wired yet — that's the
 * prom-client follow-up. For now ops sample the same signal
 * via the `cache_hit` / `cache_miss` debug log events.
 *
 * Installed by prompt [IV.18.10.5].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { TripBalancesCache } from '../src/modules/social/infrastructure/trip-balances-cache';
import { uniqueSuffix } from './factories';

describe('TypedRedisCache.getStats() (integration, requires Docker Redis)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let cache: TripBalancesCache;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await app.register(fastifyCookie);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    cache = moduleRef.get(TripBalancesCache);
    // Force a connect attempt so subsequent gets either hit or miss
    // — but never fail the test on a broken Redis.
    await cache.get('warmup-probe');
  });

  afterAll(async () => {
    await app.close();
    await moduleRef.close();
  });

  it('namespace label exposed on getStats()', () => {
    const stats = cache.getStats();
    expect(stats.namespace).toBe('trip-balances');
    expect(typeof stats.hits).toBe('number');
    expect(typeof stats.misses).toBe('number');
  });

  it('cold get on an unknown key increments misses (not hits)', async () => {
    const before = cache.getStats();
    const unknownKey = `cache-stats-test-unknown-${uniqueSuffix()}`;
    const result = await cache.get(unknownKey);
    expect(result).toBeNull();
    const after = cache.getStats();
    expect(after.misses).toBe(before.misses + 1);
    expect(after.hits).toBe(before.hits);
  });

  it('warmed key increments hits (not misses) on subsequent get', async () => {
    const key = `cache-stats-test-warm-${uniqueSuffix()}`;
    await cache.set(key, [], 60);
    const before = cache.getStats();
    const result = await cache.get(key);
    expect(result).toEqual([]);
    const after = cache.getStats();
    expect(after.hits).toBe(before.hits + 1);
    expect(after.misses).toBe(before.misses);
  });

  it('counters are monotonic across mixed access patterns', async () => {
    const before = cache.getStats();
    // 2 misses + 1 hit (after warm).
    await cache.get(`monotonic-miss-1-${uniqueSuffix()}`);
    await cache.get(`monotonic-miss-2-${uniqueSuffix()}`);
    const warmKey = `monotonic-warm-${uniqueSuffix()}`;
    await cache.set(warmKey, [], 60);
    await cache.get(warmKey);
    const after = cache.getStats();
    expect(after.misses).toBe(before.misses + 2);
    expect(after.hits).toBe(before.hits + 1);
  });
});
