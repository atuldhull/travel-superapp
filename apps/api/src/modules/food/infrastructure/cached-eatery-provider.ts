/**
 * Decorator over `EateryProvider` that caches results in
 * `EATERY_CACHE`. Keyed on every search parameter because each
 * genuinely changes the result set.
 *
 * TTL 30 minutes — eatery metadata (name, cuisine, price tier) is
 * stable enough that half an hour of cache is safe, and the
 * provider cost per search is real (Google Places / Yelp charge
 * per call). If we ever layer in "hours open right now" that'd
 * drop the TTL.
 *
 * Installed by prompt [IV.18.7.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { createLogger } from '@app/logger';
import type { EateryListing } from '../domain/eatery-listing.entity';
import type { EateryProvider, SearchEateriesInput } from '../application/ports/eatery-provider';
import { EATERY_CACHE, type EateryCache } from '../application/ports/eatery-cache';
import { MockEateryProvider } from './mock-eatery-provider';

const CACHE_TTL_SECONDS = 30 * 60;
const log = createLogger('food.cached-provider');

@Injectable()
export class CachedEateryProvider implements EateryProvider {
  constructor(
    @Inject(MockEateryProvider) private readonly inner: EateryProvider,
    @Inject(EATERY_CACHE) private readonly cache: EateryCache,
  ) {}

  async searchNearby(input: SearchEateriesInput): Promise<readonly EateryListing[]> {
    const key = cacheKey(input);
    const cached = await this.cache.get(key);
    if (cached) {
      log.debug({ key }, 'eatery_cache_hit');
      return cached;
    }
    const fresh = await this.inner.searchNearby(input);
    await this.cache.set(key, fresh, CACHE_TTL_SECONDS);
    return fresh;
  }
}

function cacheKey(input: SearchEateriesInput): string {
  // Same 3-decimal (~110m) coord coarsening as Weather + Stays.
  return [
    input.lat.toFixed(3),
    input.lng.toFixed(3),
    input.radiusKm.toFixed(1),
    input.cuisineTag ?? '',
    input.maxPriceTier ?? '',
  ].join(':');
}
