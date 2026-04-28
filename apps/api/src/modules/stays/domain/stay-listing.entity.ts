/**
 * Plain-data domain type for a stay listing returned by a provider.
 *
 * Kept flat — no split between "stay metadata" and "price quote" —
 * because the v1 search surface is read-only. If we later build a
 * booking flow (`StayBooking`) or historical price tracking
 * (`StayPrice`) the provider's response shape can evolve without
 * breaking this read model.
 *
 * `priceUsdPerNight` / `currency` are optional — some providers
 * return listings without live availability; surface them so users
 * can still see the option and click through for a quote.
 *
 * Installed by prompt [IV.18.6.1].
 */
export interface StayListing {
  /** Stable id within the originating provider's namespace, e.g.
   *  `booking:1234567` or `mock:mountain-lodge-alpine`. */
  readonly externalId: string;
  readonly provider: string;
  readonly name: string;
  readonly starRating: number | null;
  readonly amenities: readonly string[];
  readonly lat: number;
  readonly lng: number;
  readonly distanceMeters: number;
  readonly priceUsdPerNight: number | null;
  readonly currency: string | null;
  /**
   * V.UX.16 — coarse property-type slug. Lets the budget-backpacker
   * persona filter stays to `'hostel'`, the family persona prefer
   * `'apartment'`, etc. Free-form on the wire so new types
   * (`'guesthouse'`, `'capsule'`) don't need a provider-port edit.
   * Mock provider tags its three fixtures as `'boutique'` /
   * `'inn'` / `'hostel'`.
   */
  readonly stayType: string;
}
