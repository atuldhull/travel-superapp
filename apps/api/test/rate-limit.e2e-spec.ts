/**
 * Integration test for the Redis sliding-window rate limiter
 * ([III.11.4]). Requires the Docker Redis container running.
 *
 * Acceptance: the 11th call within the window on the `ai` bucket
 * returns 429. The `default` bucket (60/min) is NOT exhausted by 11
 * calls — proves bucket isolation.
 *
 * Installed by prompt [III.11.4].
 */
import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { AppConfigModule } from '@app/config';
import { RateLimitGuard } from '../src/common/rate-limit/rate-limit.guard';
import { RateLimitModule } from '../src/common/rate-limit/rate-limit.module';
import { RedisThrottlerStorage } from '../src/common/rate-limit/redis-throttler.storage';

// Dedicated test-only controller. Not part of the app's production
// surface — declared here so we don't pollute `apps/api/src`.
@Controller('rate-limit-test')
class RateLimitTestController {
  // `@nestjs/throttler` v6 stacks ALL named throttlers on every route.
  // Routes that mean "only the `ai` budget applies" must explicitly
  // skip the others, otherwise the strictest one (`auth` at 5/min)
  // would kick in first.
  @Get('ai')
  @SkipThrottle({ default: true, auth: true })
  @Throttle({ ai: { limit: 10, ttl: 60_000 } })
  aiBucket(): { ok: true } {
    return { ok: true };
  }

  @Get('default')
  @SkipThrottle({ ai: true, auth: true })
  defaultBucket(): { ok: true } {
    return { ok: true };
  }
}

@Module({
  imports: [AppConfigModule.forRoot(), RateLimitModule],
  controllers: [RateLimitTestController],
  providers: [{ provide: APP_GUARD, useClass: RateLimitGuard }],
})
class RateLimitTestAppModule {}

// RFC 5737 TEST-NET-3. Unique per test-run so stale Redis state from a
// previous invocation doesn't contaminate the sliding window.
const SOURCE_IP = `203.0.113.${(process.pid % 200) + 50}`;

describe('Rate-limit sliding window (integration, requires Docker Redis)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let storage: RedisThrottlerStorage;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [RateLimitTestAppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ logger: false, trustProxy: true }),
      { logger: false, bufferLogs: false },
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    storage = moduleRef.get(RedisThrottlerStorage);

    // Touch the storage once to prove Redis is reachable.
    await storage.increment('connectivity-probe', 1_000, 999, 0, 'default');
  });

  afterAll(async () => {
    await app.close();
  });

  it('the 11th call on the `ai` bucket returns 429 within the TTL window', async () => {
    const inject = (): Promise<{ statusCode: number; headers: Record<string, unknown> }> =>
      app
        .inject({
          method: 'GET',
          url: '/rate-limit-test/ai',
          remoteAddress: SOURCE_IP,
        })
        .then((res) => ({
          statusCode: res.statusCode,
          headers: res.headers as Record<string, unknown>,
        }));

    // Calls 1–10 should all return 200.
    for (let i = 1; i <= 10; i++) {
      const res = await inject();
      expect(res.statusCode).toBe(200);
    }

    // The 11th MUST be rate-limited.
    const eleventh = await inject();
    expect(eleventh.statusCode).toBe(429);
    // `@nestjs/throttler` v6 suffixes the header with the throttler
    // name when it's not `default`: blocked AI bucket sends
    // `Retry-After-ai: <ms>`. Standard `Retry-After` would come from
    // the `default` bucket.
    expect(eleventh.headers['retry-after-ai']).toBeDefined();
  });

  it('the `default` bucket (60/min) is NOT exhausted by the 11 earlier hits on `ai` — proves bucket isolation', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/rate-limit-test/default',
      remoteAddress: SOURCE_IP,
    });
    expect(res.statusCode).toBe(200);
  });
});
