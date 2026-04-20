import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerStorage } from '@nestjs/throttler';
import { RateLimitGuard } from './rate-limit.guard';
import { RedisThrottlerStorage } from './redis-throttler.storage';

/**
 * Inner module that just provides `RedisThrottlerStorage` — split
 * out so `ThrottlerModule.forRootAsync` can `imports:` it and resolve
 * the storage in its factory. Nest's `forRootAsync` only sees
 * providers from modules in its own `imports:` list, not from the
 * parent module where we register it.
 */
@Module({
  providers: [
    RedisThrottlerStorage,
    { provide: ThrottlerStorage, useExisting: RedisThrottlerStorage },
  ],
  exports: [RedisThrottlerStorage, ThrottlerStorage],
})
class RateLimitStorageModule {}

/**
 * Wires `@nestjs/throttler` with three named buckets:
 *   • `default` — 60 req/min. Every decorated route inherits this.
 *   • `ai`      — 10 req/min. AI endpoints (expensive; budget-critical).
 *   • `auth`    — 5 req/min.  Login / password-reset / MFA verify.
 *
 * Bucket selection:
 *   @Throttle({ ai:  { limit: 10, ttl: 60_000 } })   // forces ai bucket
 *   @Throttle({ auth:{ limit:  5, ttl: 60_000 } })   // forces auth bucket
 *   (no decorator)                                    // default bucket
 *
 * Storage is Redis sliding-window (`RedisThrottlerStorage`) so the
 * limits are shared across pods.
 *
 * Guard is `RateLimitGuard` — same behaviour as `ThrottlerGuard` plus
 * user-aware tracker. Wire it as a global guard via `APP_GUARD` in
 * `AppModule` (not here — modules don't register APP_GUARD).
 *
 * Installed by prompt [III.11.4].
 */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [RateLimitStorageModule],
      inject: [ConfigService, RedisThrottlerStorage],
      useFactory: (
        config: ConfigService<Record<string, unknown>, true>,
        storage: RedisThrottlerStorage,
      ) => {
        const isTest = config.get('NODE_ENV', { infer: true }) === 'test';
        // In tests, inflate bucket limits so cumulative traffic from
        // unrelated test files doesn't trip the default/auth buckets.
        // The rate-limit integration test uses `@Throttle({ ai: {
        // limit: 10 } })` which overrides at the route level — that
        // decorator-level limit stays authoritative, so the 10/min AI
        // test still works.
        const mult = isTest ? 10_000 : 1;
        return {
          throttlers: [
            { name: 'default', limit: 60 * mult, ttl: 60_000 },
            { name: 'ai', limit: 10 * mult, ttl: 60_000 },
            { name: 'auth', limit: 5 * mult, ttl: 60_000 },
          ],
          storage,
          // Emit X-RateLimit-* + Retry-After headers. v6 suffixes them
          // with the throttler name when it's not 'default' — so a
          // blocked AI bucket sends `Retry-After-ai: <ms>`, a blocked
          // default bucket sends the standard `Retry-After: <ms>`.
          setHeaders: true,
        };
      },
    }),
    RateLimitStorageModule,
  ],
  providers: [RateLimitGuard],
  exports: [ThrottlerModule, RateLimitGuard, RateLimitStorageModule],
})
export class RateLimitModule {}
