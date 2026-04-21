/**
 * Test helpers: stubbed providers that let AppModule boot without
 * Docker. Use in test suites whose assertions don't need real
 * Postgres / Redis — header matrices, trace-id middleware, health
 * probes with mocked indicators, the Phase-0 smoke suite.
 *
 * Suites that DO need the real stack (identity, trips, etc.) use
 * the try/catch-around-`app.init()` pattern instead and skip
 * cleanly when infra is down.
 *
 * Installed by prompt [IV.18.2.5] — skip-pattern back-port.
 */
import type { TestingModuleBuilder } from '@nestjs/testing';
import { PrismaService } from '../../src/common/db/prisma.service';
import { RedisThrottlerStorage } from '../../src/common/rate-limit/redis-throttler.storage';

/**
 * No-op Prisma stub: onModuleInit / onModuleDestroy don't touch a
 * real server, and $queryRaw returns an empty array. All delegate
 * methods are absent — tests that call them will surface a clear
 * TypeError instead of silent data loss.
 */
export const prismaStub = {
  onModuleInit: async () => {},
  onModuleDestroy: async () => {},
  $connect: async () => {},
  $disconnect: async () => {},
  $queryRaw: async () => [] as unknown[],
};

/**
 * Always-under-limit throttler storage. Returns count = 0, no
 * block. Lets the global RateLimitGuard run without Redis. Not
 * suitable for rate-limit assertions — those suites bring their
 * own RateLimitTestAppModule.
 */
export const throttlerStorageStub = {
  async increment(): Promise<{
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
  }> {
    return { totalHits: 0, timeToExpire: 60_000, isBlocked: false, timeToBlockExpire: 0 };
  },
  async onModuleDestroy(): Promise<void> {},
};

/**
 * Apply the offline stubs to a `Test.createTestingModule` builder
 * in one call. Chain this before `.compile()`:
 *
 *   const moduleRef = await applyOfflineStubs(
 *     Test.createTestingModule({ imports: [AppModule] }),
 *   ).compile();
 */
export function applyOfflineStubs(builder: TestingModuleBuilder): TestingModuleBuilder {
  return builder
    .overrideProvider(PrismaService)
    .useValue(prismaStub)
    .overrideProvider(RedisThrottlerStorage)
    .useValue(throttlerStorageStub);
}
