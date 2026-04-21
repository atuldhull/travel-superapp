/**
 * Port for caching federated-search results. Fourth consumer of the
 * cache-around-port pattern (Weather + Stays + Food + now Places);
 * adapter is a `TypedRedisCache<T>` subclass in infrastructure.
 *
 * Installed by prompt [IV.18.4.1].
 */
import type { FederatedPlaceResult } from '../../domain/federated-place-result.entity';

export interface PlaceSearchCache {
  get(key: string): Promise<readonly FederatedPlaceResult[] | null>;
  set(key: string, value: readonly FederatedPlaceResult[], ttlSeconds: number): Promise<void>;
}

export const PLACE_SEARCH_CACHE = Symbol('PlaceSearchCache');
