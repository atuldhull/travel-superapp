/**
 * A place search result returned by an external provider (Google
 * Places, Foursquare, OSM Overpass, ...). Distinct from the internal
 * `Place` domain entity because:
 *
 *   - No `id` — the place may not exist in our catalog yet. When a
 *     federation-driven write-through lands (follow-up slice), we'll
 *     either find the matching local `Place` by `(provider, externalId)`
 *     or insert a fresh row.
 *   - No `createdAt` / `updatedAt` — provenance belongs to the writer.
 *   - `relaxationScore` omitted — that's a curated local signal, not
 *     something providers have.
 *
 * This is the unit of data that flows through `PlaceProvider.search`.
 * Callers aware of our catalog reconcile results client-side or via
 * a future merge use-case.
 *
 * Installed by prompt [IV.18.4.1].
 */
export interface FederatedPlaceResult {
  readonly externalId: string;
  readonly provider: string;
  readonly name: string;
  readonly category: string;
  readonly address: string | null;
  readonly countryCode: string | null;
  readonly lat: number;
  readonly lng: number;
  readonly distanceMeters: number;
}
