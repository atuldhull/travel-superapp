/**
 * Plain-data domain type for an event search result.
 *
 * v1 keeps the shape tight: enough to render a list + click-through.
 * The `Event` Prisma model supports richer signals (priceMin/Max,
 * venueName, description) which real-provider integrations will
 * populate in follow-up slices.
 *
 * ISO-8601 datetime strings on the wire — the provider does its
 * own timezone resolution and returns absolute UTC instants. Client
 * converts to local on render.
 *
 * Installed by prompt [IV.18.9.1].
 */
export interface EventListing {
  readonly externalId: string;
  readonly provider: string;
  readonly title: string;
  readonly description: string | null;
  readonly category: string;
  readonly venueName: string | null;
  readonly lat: number;
  readonly lng: number;
  readonly distanceMeters: number;
  readonly startsAt: string;
  readonly endsAt: string;
  /** ISO-4217 currency code or null for free events. */
  readonly currency: string | null;
  /** Decimal string to preserve precision across JSON. `null` for free. */
  readonly priceMin: string | null;
  readonly priceMax: string | null;
  readonly sourceUrl: string | null;
}
