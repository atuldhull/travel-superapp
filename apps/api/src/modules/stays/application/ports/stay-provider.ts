/**
 * Port for a stay data provider. `[IV.18.6.1]` ships one adapter
 * (`MockStayProvider` returning canned data) — real providers
 * (Booking.com via Amadeus, Airbnb public scrape) land as sibling
 * adapters once credentials are sorted.
 *
 * The port is narrow on purpose — just `searchNearby`. Booking,
 * cancellation, history look-ups belong to dedicated ports in the
 * booking-flow slice (not in scope for v1 read search).
 *
 * Installed by prompt [IV.18.6.1].
 */
import type { StayListing } from '../../domain/stay-listing.entity';

export interface SearchStaysInput {
  readonly lat: number;
  readonly lng: number;
  readonly radiusKm: number;
  /** ISO date strings (YYYY-MM-DD). Use-case validates ordering. */
  readonly checkIn: string;
  readonly checkOut: string;
  /** 1 ≤ guests ≤ 20 by domain invariant; use-case enforces. */
  readonly guests: number;
}

export interface StayProvider {
  searchNearby(input: SearchStaysInput): Promise<readonly StayListing[]>;
}

export const STAY_PROVIDER = Symbol('StayProvider');
