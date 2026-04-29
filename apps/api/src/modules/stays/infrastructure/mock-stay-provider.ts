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
        stayType: 'boutique',
        wifiSpeedMbps: 120,
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
        stayType: 'inn',
        wifiSpeedMbps: 60,
      },
      {
        externalId: `${PROVIDER}:budget-${round(input.lat)}-${round(input.lng)}`,
        provider: PROVIDER,
        name: 'Budget Hostel',
        starRating: 2.5,
        amenities: ['wifi'],
        lat: input.lat + 0.035,
        lng: input.lng + 0.022,
        distanceMeters: 4_000,
        priceUsdPerNight: 25,
        currency: 'USD',
        stayType: 'hostel',
        wifiSpeedMbps: 15,
      },
      // V.UX.23 — digital-nomad fixture: monthly rental with strong
      // wifi. Priced as the per-night equivalent of a $1500/month
      // serviced apartment (≈ $50/night) so a long-stay search keeps
      // the daily-budget banner sane.
      {
        externalId: `${PROVIDER}:nomad-loft-${round(input.lat)}-${round(input.lng)}`,
        provider: PROVIDER,
        name: 'Nomad Loft (monthly)',
        starRating: 4.0,
        amenities: ['wifi', 'workspace', 'kitchen', 'laundry'],
        lat: input.lat + 0.005,
        lng: input.lng + 0.004,
        distanceMeters: 700,
        priceUsdPerNight: 50,
        currency: 'USD',
        stayType: 'monthly',
        wifiSpeedMbps: 200,
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
