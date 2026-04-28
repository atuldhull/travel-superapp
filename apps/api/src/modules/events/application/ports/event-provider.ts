/**
 * Port for an external events provider. `[IV.18.9.1]` ships a
 * deterministic mock; real adapters (Meetup, Eventbrite public,
 * local-scraper) land as siblings when credentials + crawler
 * robots-txt policy are sorted.
 *
 * Installed by prompt [IV.18.9.1].
 */
import type { EventListing } from '../../domain/event-listing.entity';

export interface SearchEventsInput {
  readonly lat: number;
  readonly lng: number;
  readonly radiusKm: number;
  /** ISO-8601 window (absolute UTC). Use-case validates ordering. */
  readonly from: string;
  readonly to: string;
  readonly category?: string;
  /**
   * V.UX.16 — when true, only events with `priceMin` of '0.00' or
   * null (free / no-price-info) are returned. Default false.
   */
  readonly freeOnly?: boolean;
}

export interface EventProvider {
  searchNearby(input: SearchEventsInput): Promise<readonly EventListing[]>;
}

export const EVENT_PROVIDER = Symbol('EventProvider');
