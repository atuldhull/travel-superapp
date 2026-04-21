/**
 * Plain-data domain type for an eatery search result.
 *
 * v1 keeps the shape tight: metadata + distance only. `Dish`/`DishTag`
 * exist in the Prisma schema for the eventual provider integration
 * where we enrich listings with menu snippets + crowd-reported prices.
 * Until then, callers render cuisine tags + price tier as the
 * top-level signals.
 *
 * `priceTier` is 1–5 (playbook convention — $ through $$$$$).
 *
 * Installed by prompt [IV.18.7.1].
 */
export interface EateryListing {
  readonly externalId: string;
  readonly provider: string;
  readonly name: string;
  readonly cuisineTags: readonly string[];
  readonly priceTier: number;
  readonly lat: number;
  readonly lng: number;
  readonly distanceMeters: number;
}
