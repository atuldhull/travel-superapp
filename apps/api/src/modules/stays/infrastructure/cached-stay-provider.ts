/**
 * Decorator over the upstream `StayProvider` that caches results in
 * `STAY_CACHE`. Keyed on `(lat, lng, radiusKm, checkIn, checkOut,
 * guests)` — all search parameters participate because a different
 * value for any of them legitimately changes the result set.
 *
 * Same decorator-of-DI pattern as `CachedWeatherProvider` — the
 * raw upstream `MockStayProvider` is registered as its own class
 * token so this decorator can @Inject it by class without
 * self-recursing against the `STAY_PROVIDER` port symbol.
 *
 * TTL is 15 minutes — shorter than weather (30 min) because stay
 * prices + availability shift faster, and stale "rooms available"
 * responses are user-facing bugs.
 *
 * Installed by prompt [IV.18.6.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { createLogger } from '@app/logger';
import type { StayListing } from '../domain/stay-listing.entity';
import type { SearchStaysInput, StayProvider } from '../application/ports/stay-provider';
import { STAY_CACHE, type StayCache } from '../application/ports/stay-cache';
import { MockStayProvider } from './mock-stay-provider';

const CACHE_TTL_SECONDS = 15 * 60;
const log = createLogger('stays.cached-provider');

@Injectable()
export class CachedStayProvider implements StayProvider {
  constructor(
    @Inject(MockStayProvider) private readonly inner: StayProvider,
    @Inject(STAY_CACHE) private readonly cache: StayCache,
  ) {}

  async searchNearby(input: SearchStaysInput): Promise<readonly StayListing[]> {
    const key = cacheKey(input);
    const cached = await this.cache.get(key);
    if (cached) {
      log.debug({ key }, 'stay_cache_hit');
      return cached;
    }
    const fresh = await this.inner.searchNearby(input);
    await this.cache.set(key, fresh, CACHE_TTL_SECONDS);
    return fresh;
  }
}

function cacheKey(input: SearchStaysInput): string {
  // 3-decimal coord (~110m) mirrors the weather cache — keeps the
  // keyspace bounded without colliding across city blocks.
  return [
    input.lat.toFixed(3),
    input.lng.toFixed(3),
    input.radiusKm.toFixed(1),
    input.checkIn,
    input.checkOut,
    input.guests,
  ].join(':');
}
