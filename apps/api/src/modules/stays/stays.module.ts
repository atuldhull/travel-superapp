/**
 * Stays feature module. Clean-hex layering + decorated provider
 * (same pattern Weather established in [IV.18.5.2]):
 *
 *   controller (interface)
 *     → SearchStaysUseCase (application)
 *       → STAY_PROVIDER port (application)
 *         ← CachedStayProvider (infrastructure)
 *             ├── MockStayProvider (canned data)
 *             └── STAY_CACHE port → RedisStayCache (infra)
 *
 * Real providers (Amadeus, Booking.com partner, Airbnb scrape) drop
 * in as sibling classes implementing `StayProvider`; flip the
 * `useClass` on the `MockStayProvider` registration and the
 * decorator auto-wraps them.
 *
 * Installed by prompt [IV.18.6.1].
 */
import { Module } from '@nestjs/common';
import { SearchStaysUseCase } from './application/search-stays.use-case';
import { STAY_CACHE } from './application/ports/stay-cache';
import { STAY_PROVIDER } from './application/ports/stay-provider';
import { CachedStayProvider } from './infrastructure/cached-stay-provider';
import { MockStayProvider } from './infrastructure/mock-stay-provider';
import { RedisStayCache } from './infrastructure/redis-stay-cache';
import { StaysController } from './interface/stays.controller';

@Module({
  controllers: [StaysController],
  providers: [
    // Raw upstream as its own class token so the decorator can
    // @Inject(MockStayProvider) without circular resolution against
    // STAY_PROVIDER.
    MockStayProvider,
    { provide: STAY_CACHE, useClass: RedisStayCache },
    { provide: STAY_PROVIDER, useClass: CachedStayProvider },
    SearchStaysUseCase,
  ],
  exports: [STAY_PROVIDER],
})
export class StaysModule {}
