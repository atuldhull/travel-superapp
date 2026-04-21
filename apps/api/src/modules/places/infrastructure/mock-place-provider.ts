/**
 * Deterministic mock place provider. Returns 4 fixture results
 * spanning categories so filter tests have meaningful data without
 * paid upstream (Google Places / FSQ / OSM Overpass).
 *
 * Real adapters land as sibling classes in follow-up slices; swap
 * via `PLACE_PROVIDER` token in the module.
 *
 * Installed by prompt [IV.18.4.1].
 */
import { Injectable } from '@nestjs/common';
import type { FederatedPlaceResult } from '../domain/federated-place-result.entity';
import type { FederatedPlaceSearchInput, PlaceProvider } from '../application/ports/place-provider';

const PROVIDER = 'mock';

@Injectable()
export class MockPlaceProvider implements PlaceProvider {
  async search(input: FederatedPlaceSearchInput): Promise<readonly FederatedPlaceResult[]> {
    const all: FederatedPlaceResult[] = [
      makeResult(input, {
        slug: 'museum',
        name: 'National Museum',
        category: 'museum',
        offsetLat: 0.002,
        offsetLng: 0.001,
        distanceMeters: 250,
      }),
      makeResult(input, {
        slug: 'cafe',
        name: 'Corner Cafe',
        category: 'cafe',
        offsetLat: 0.006,
        offsetLng: 0.004,
        distanceMeters: 750,
      }),
      makeResult(input, {
        slug: 'park',
        name: 'Riverside Park',
        category: 'park',
        offsetLat: 0.013,
        offsetLng: 0.009,
        distanceMeters: 1_600,
      }),
      makeResult(input, {
        slug: 'viewpoint',
        name: 'Summit Viewpoint',
        category: 'viewpoint',
        offsetLat: 0.035,
        offsetLng: 0.022,
        distanceMeters: 4_200,
      }),
    ];

    return all
      .filter((r) => r.distanceMeters <= input.radiusKm * 1_000)
      .filter((r) => (input.category ? r.category === input.category.toLowerCase() : true))
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  }
}

interface Fixture {
  readonly slug: string;
  readonly name: string;
  readonly category: string;
  readonly offsetLat: number;
  readonly offsetLng: number;
  readonly distanceMeters: number;
}

function makeResult(input: FederatedPlaceSearchInput, f: Fixture): FederatedPlaceResult {
  return {
    externalId: `${PROVIDER}:${f.slug}-${input.lat.toFixed(3)}-${input.lng.toFixed(3)}`,
    provider: PROVIDER,
    name: f.name,
    category: f.category,
    address: null,
    countryCode: null,
    lat: input.lat + f.offsetLat,
    lng: input.lng + f.offsetLng,
    distanceMeters: f.distanceMeters,
  };
}
