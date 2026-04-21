/**
 * Port for caching eatery-search results. Mirrors `StayCache` /
 * `WeatherCache` — same narrow get/set shape over opaque keys. The
 * imminent `@app/cache` extraction (triggered by this being the 3rd
 * copy of the pattern) will replace these with a generic type; until
 * then, matching shapes make the extraction a find-and-replace.
 *
 * Installed by prompt [IV.18.7.1].
 */
import type { EateryListing } from '../../domain/eatery-listing.entity';

export interface EateryCache {
  get(key: string): Promise<readonly EateryListing[] | null>;
  set(key: string, value: readonly EateryListing[], ttlSeconds: number): Promise<void>;
}

export const EATERY_CACHE = Symbol('EateryCache');
