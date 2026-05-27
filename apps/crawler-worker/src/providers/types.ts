/**
 * Shared types for the crawler-worker provider adapters.
 *
 * Each provider returns a list of `CrawlHit` rows; the worker collates
 * + de-duplicates by external id before reporting / persisting. Keeping
 * the shape minimal here means we can add Google Places + FSQ fields
 * later without breaking OSM-only callers.
 */
export interface CrawlHit {
  /** Provider name — 'osm' | 'google-places' | 'foursquare'. */
  readonly provider: string;
  /** Provider-side stable id (osm: 'node/123', google: 'ChIJ…', fsq: 'fsq-…'). */
  readonly externalId: string;
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
  /** Coarse category — provider-specific slug, e.g. 'restaurant', 'museum'. */
  readonly category: string;
  /** Distance from the search centre in metres (provider-reported or computed). */
  readonly distanceMeters: number;
  /** Optional address line; null when the provider doesn't supply one. */
  readonly address: string | null;
}

export interface ProviderQuery {
  readonly lat: number;
  readonly lng: number;
  readonly radiusM: number;
  readonly nameHint?: string;
}
