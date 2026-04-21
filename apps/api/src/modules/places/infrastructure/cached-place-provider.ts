/**
 * Decorator over the upstream `PlaceProvider` that caches results
 * in `PLACE_SEARCH_CACHE`. Keyed on every search parameter.
 *
 * Same decorator-of-DI pattern as Weather/Stays/Food: raw
 * `MockPlaceProvider` is registered as its own class token so this
 * decorator can `@Inject(MockPlaceProvider)` without circular
 * self-resolution against `PLACE_PROVIDER`.
 *
 * TTL 30 minutes. Places catalog metadata is stable (name, category,
 * address) — stale results are cheap compared to re-hitting paid
 * providers for a hot search loop. When provider integrations layer
 * in "hours open" / "rating updated-at" this may tighten.
 *
 * Installed by prompt [IV.18.4.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { createLogger } from '@app/logger';
import type { FederatedPlaceResult } from '../domain/federated-place-result.entity';
import type { FederatedPlaceSearchInput, PlaceProvider } from '../application/ports/place-provider';
import { PLACE_SEARCH_CACHE, type PlaceSearchCache } from '../application/ports/place-search-cache';
import { MockPlaceProvider } from './mock-place-provider';

const CACHE_TTL_SECONDS = 30 * 60;
const log = createLogger('places.cached-provider');

@Injectable()
export class CachedPlaceProvider implements PlaceProvider {
  constructor(
    @Inject(MockPlaceProvider) private readonly inner: PlaceProvider,
    @Inject(PLACE_SEARCH_CACHE) private readonly cache: PlaceSearchCache,
  ) {}

  async search(input: FederatedPlaceSearchInput): Promise<readonly FederatedPlaceResult[]> {
    const key = cacheKey(input);
    const cached = await this.cache.get(key);
    if (cached) {
      log.debug({ key }, 'places_cache_hit');
      return cached;
    }
    const fresh = await this.inner.search(input);
    await this.cache.set(key, fresh, CACHE_TTL_SECONDS);
    return fresh;
  }
}

function cacheKey(input: FederatedPlaceSearchInput): string {
  // Same 3-decimal (~110m) coord coarsening Weather/Stays/Food use.
  return [
    input.lat.toFixed(3),
    input.lng.toFixed(3),
    input.radiusKm.toFixed(1),
    input.category ?? '',
  ].join(':');
}
