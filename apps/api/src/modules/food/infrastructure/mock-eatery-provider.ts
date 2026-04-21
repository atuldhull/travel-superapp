/**
 * Deterministic mock eatery provider. Returns 4 fixture listings
 * spanning cuisines + price tiers so filter tests have something
 * interesting to exercise without a paid upstream.
 *
 * Real providers (Yelp Fusion, Google Places, Zomato) land as
 * sibling classes in a follow-up slice. Swap via `EATERY_PROVIDER`
 * token in the module — no call-site changes.
 *
 * Installed by prompt [IV.18.7.1].
 */
import { Injectable } from '@nestjs/common';
import type { EateryListing } from '../domain/eatery-listing.entity';
import type { EateryProvider, SearchEateriesInput } from '../application/ports/eatery-provider';

const PROVIDER = 'mock';

@Injectable()
export class MockEateryProvider implements EateryProvider {
  async searchNearby(input: SearchEateriesInput): Promise<readonly EateryListing[]> {
    const base: EateryListing[] = [
      makeListing(input, {
        slug: 'ramen-spot',
        name: 'Neon Ramen',
        cuisineTags: ['japanese', 'ramen', 'noodles'],
        priceTier: 2,
        offsetLat: 0.001,
        offsetLng: 0.002,
        distanceMeters: 250,
      }),
      makeListing(input, {
        slug: 'trattoria',
        name: 'Trattoria Bellini',
        cuisineTags: ['italian', 'pasta'],
        priceTier: 3,
        offsetLat: 0.008,
        offsetLng: 0.005,
        distanceMeters: 900,
      }),
      makeListing(input, {
        slug: 'taco-stand',
        name: 'Taco Cantina',
        cuisineTags: ['mexican', 'street'],
        priceTier: 1,
        offsetLat: 0.015,
        offsetLng: 0.012,
        distanceMeters: 1_900,
      }),
      makeListing(input, {
        slug: 'omakase',
        name: 'Omakase Hifumi',
        cuisineTags: ['japanese', 'sushi', 'fine-dining'],
        priceTier: 5,
        offsetLat: 0.026,
        offsetLng: 0.019,
        distanceMeters: 3_200,
      }),
    ];

    return base
      .filter((e) => e.distanceMeters <= input.radiusKm * 1_000)
      .filter((e) =>
        input.cuisineTag ? e.cuisineTags.includes(input.cuisineTag.toLowerCase()) : true,
      )
      .filter((e) => (input.maxPriceTier !== undefined ? e.priceTier <= input.maxPriceTier : true))
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  }
}

interface Fixture {
  readonly slug: string;
  readonly name: string;
  readonly cuisineTags: readonly string[];
  readonly priceTier: number;
  readonly offsetLat: number;
  readonly offsetLng: number;
  readonly distanceMeters: number;
}

function makeListing(input: SearchEateriesInput, f: Fixture): EateryListing {
  return {
    externalId: `${PROVIDER}:${f.slug}-${input.lat.toFixed(3)}-${input.lng.toFixed(3)}`,
    provider: PROVIDER,
    name: f.name,
    cuisineTags: f.cuisineTags,
    priceTier: f.priceTier,
    lat: input.lat + f.offsetLat,
    lng: input.lng + f.offsetLng,
    distanceMeters: f.distanceMeters,
  };
}
