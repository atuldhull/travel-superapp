/**
 * Port for caching event-search results. Fifth consumer of the
 * cache-around-port pattern (Weather + Stays + Food + Places + now
 * Events); adapter is a `TypedRedisCache<T>` subclass.
 *
 * Installed by prompt [IV.18.9.1].
 */
import type { EventListing } from '../../domain/event-listing.entity';

export interface EventCache {
  get(key: string): Promise<readonly EventListing[] | null>;
  set(key: string, value: readonly EventListing[], ttlSeconds: number): Promise<void>;
}

export const EVENT_CACHE = Symbol('EventCache');
