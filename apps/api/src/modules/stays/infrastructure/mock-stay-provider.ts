/**
 * Deterministic mock stay provider. Returns 3 synthetic listings
 * in concentric rings around the query point, so search results
 * are predictable + testable without a paid upstream integration.
 *
 * Real providers (Amadeus, Booking.com partner API, Airbnb public
 * scrape) land as sibling adapters in a follow-up slice once
 * credentials are sorted. The `STAY_PROVIDER` token flip in
 * `stays.module.ts` is the only change the swap needs.
 *
 * Installed by prompt [IV.18.6.1].
 */
import { Injectable } from '@nestjs/common';
import type { StayListing } from '../domain/stay-listing.entity';
import type { SearchStaysInput, StayProvider } from '../application/ports/stay-provider';

const PROVIDER = 'mock';

@Injectable()
export class MockStayProvider implements StayProvider {
  async searchNearby(input: SearchStaysInput): Promise<readonly StayListing[]> {
    // Three rings: 200m, 1.5km, 4km from the query point. Prices
    // scale down with distance (inner = city-centre premium, outer
    // = suburban cheap). Deterministic so tests can assert exact
    // ordering.
    const nights = Math.max(
      1,
      Math.round((Date.parse(input.checkOut) - Date.parse(input.checkIn)) / 86_400_000),
    );
    const listings: StayListing[] = [
      {
        externalId: `${PROVIDER}:central-${round(input.lat)}-${round(input.lng)}`,
        provider: PROVIDER,
        name: 'Central Boutique',
        starRating: 4.5,
        amenities: ['wifi', 'breakfast', 'gym'],
        lat: input.lat + 0.002,
        lng: input.lng + 0.001,
        distanceMeters: 200,
        priceUsdPerNight: 180 + input.guests * 10,
        currency: 'USD',
      },
      {
        externalId: `${PROVIDER}:midtown-${round(input.lat)}-${round(input.lng)}`,
        provider: PROVIDER,
        name: 'Midtown Inn',
        starRating: 3.5,
        amenities: ['wifi', 'parking'],
        lat: input.lat + 0.012,
        lng: input.lng + 0.008,
        distanceMeters: 1_500,
        priceUsdPerNight: 95 + input.guests * 5,
        currency: 'USD',
      },
      {
        externalId: `${PROVIDER}:budget-${round(input.lat)}-${round(input.lng)}`,
        provider: PROVIDER,
        name: 'Budget Suburb',
        starRating: 2.5,
        amenities: ['wifi'],
        lat: input.lat + 0.035,
        lng: input.lng + 0.022,
        distanceMeters: 4_000,
        priceUsdPerNight: 55,
        currency: 'USD',
      },
    ];

    // Keep only those inside the requested radius — `distanceMeters`
    // is in metres, `input.radiusKm` in km.
    const ordered = listings
      .filter((s) => s.distanceMeters <= input.radiusKm * 1_000)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
    // Touch `nights` so prices look realistic — the price ALREADY
    // represents per-night cost; this just keeps the variable alive
    // for a future total-price derivation (the shape stays flat for
    // now).
    void nights;
    return ordered;
  }
}

function round(n: number): string {
  return n.toFixed(3);
}
