/**
 * Food feature module. Clean-hex + decorated provider, same shape as
 * Weather ([IV.18.5.2]) + Stays ([IV.18.6.1]). This is the third
 * copy of the cache-around-port pattern — the extraction to a shared
 * `@app/cache` package is queued as its own slice.
 *
 *   controller (interface)
 *     → SearchEateriesUseCase (application)
 *       → EATERY_PROVIDER port (application)
 *         ← CachedEateryProvider (infrastructure)
 *             ├── MockEateryProvider (canned fixtures)
 *             └── EATERY_CACHE port → RedisEateryCache (infra)
 *
 * Installed by prompt [IV.18.7.1].
 */
import { forwardRef, Module } from '@nestjs/common';
import { TripModule } from '../trip';
import { AddDishReportUseCase } from './application/add-dish-report.use-case';
import { BuildFoodCrawlUseCase } from './application/build-food-crawl.use-case';
import { ListDishesForEateryUseCase } from './application/list-dishes-for-eatery.use-case';
import { SearchEateriesUseCase } from './application/search-eateries.use-case';
import { EATERY_CACHE } from './application/ports/eatery-cache';
import { EATERY_PROVIDER } from './application/ports/eatery-provider';
import { CachedEateryProvider } from './infrastructure/cached-eatery-provider';
import { MockEateryProvider } from './infrastructure/mock-eatery-provider';
import { RedisEateryCache } from './infrastructure/redis-eatery-cache';
import { FoodCrawlController } from './interface/food-crawl.controller';
import { FoodController } from './interface/food.controller';

@Module({
  // V.UX.20 — pulls TRIP_REPOSITORY from TripModule so the food-crawl
  // builder can owner-gate by trip. forwardRef because TripModule
  // already imports FoodModule (cross-module loop).
  imports: [forwardRef(() => TripModule)],
  controllers: [FoodController, FoodCrawlController],
  providers: [
    MockEateryProvider,
    { provide: EATERY_CACHE, useClass: RedisEateryCache },
    { provide: EATERY_PROVIDER, useClass: CachedEateryProvider },
    SearchEateriesUseCase,
    ListDishesForEateryUseCase,
    AddDishReportUseCase,
    BuildFoodCrawlUseCase,
  ],
  exports: [EATERY_PROVIDER, SearchEateriesUseCase],
})
export class FoodModule {}
