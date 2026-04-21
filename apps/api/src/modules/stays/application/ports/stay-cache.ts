/**
 * Port for caching stay-search results. Mirrors `WeatherCache` —
 * narrow get/set over opaque keys, stores domain-shape arrays (not
 * raw provider responses) so a future provider swap doesn't
 * invalidate entries.
 *
 * Installed by prompt [IV.18.6.1].
 */
import type { StayListing } from '../../domain/stay-listing.entity';

export interface StayCache {
  get(key: string): Promise<readonly StayListing[] | null>;
  set(key: string, value: readonly StayListing[], ttlSeconds: number): Promise<void>;
}

export const STAY_CACHE = Symbol('StayCache');
