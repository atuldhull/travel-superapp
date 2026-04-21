/**
 * Port for an eatery data provider. `[IV.18.7.1]` ships a
 * deterministic mock — real providers (Yelp Fusion, Google Places
 * category=restaurant, Zomato) land as sibling adapters when
 * credentials are sorted.
 *
 * Narrow on purpose: one `searchNearby` call. Dish-level enrichment
 * + reviews + booking each belong to their own ports in later
 * slices.
 *
 * Installed by prompt [IV.18.7.1].
 */
import type { EateryListing } from '../../domain/eatery-listing.entity';

export interface SearchEateriesInput {
  readonly lat: number;
  readonly lng: number;
  readonly radiusKm: number;
  /** Optional cuisine filter — exact-match against provider tags. */
  readonly cuisineTag?: string;
  /** Optional max price tier — inclusive (1..5). */
  readonly maxPriceTier?: number;
}

export interface EateryProvider {
  searchNearby(input: SearchEateriesInput): Promise<readonly EateryListing[]>;
}

export const EATERY_PROVIDER = Symbol('EateryProvider');
