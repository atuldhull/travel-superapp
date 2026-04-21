/**
 * Port for an external place-catalog provider. `[IV.18.4.1]` ships a
 * deterministic mock — real adapters (Google Places, Foursquare,
 * OSM Overpass) land as sibling classes in follow-up slices when
 * credentials + billing are sorted.
 *
 * Narrow on purpose: one `search` call. Detail-fetch, photo-URL
 * resolution, reviews belong to their own ports when callers
 * actually want them.
 *
 * Installed by prompt [IV.18.4.1].
 */
import type { FederatedPlaceResult } from '../../domain/federated-place-result.entity';

export interface FederatedPlaceSearchInput {
  readonly lat: number;
  readonly lng: number;
  readonly radiusKm: number;
  readonly category?: string;
}

export interface PlaceProvider {
  search(input: FederatedPlaceSearchInput): Promise<readonly FederatedPlaceResult[]>;
}

export const PLACE_PROVIDER = Symbol('PlaceProvider');
