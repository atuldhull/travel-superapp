/**
 * Read-only port for "give me the trip's recent media assets".
 * Owned by Trip because the Trip-overview use-case is the
 * consumer; the *implementation* lives in MediaModule (it knows
 * how to talk to `MEDIA_ASSET_REPOSITORY`).
 *
 * The bidirectional dependency (Trip needs Media for overview;
 * Media needs Trip for the trip-attach gate) is broken with
 * `forwardRef()` on both sides — the alternative would be a
 * shared seam package, which would force every cross-module read
 * to live in `packages/...` and dilute the modular-monolith
 * boundary. `forwardRef` is the documented Nest pattern for
 * exactly this situation.
 *
 * Owner-scoped on every call. The Trip-overview use-case has
 * already verified ownership before calling here; the adapter
 * still re-applies the owner filter so a future caller that
 * forgets the gate doesn't accidentally leak.
 *
 * Installed by prompt [IV.18.12.10].
 */

export interface TripMediaSummaryAsset {
  readonly id: string;
  readonly kind: 'image' | 'video';
  readonly s3KeyRaw: string;
  readonly createdAt: Date;
}

export interface TripMediaSummary {
  readonly count: number;
  readonly recent: readonly TripMediaSummaryAsset[];
}

export interface TripMediaPort {
  /**
   * Returns `{ count, recent }` for the caller's ready media
   * attached to the given trip. `recent` is capped at the
   * passed limit (default 12 — the overview surface only
   * renders a thumbnail strip). `count` reflects ALL ready
   * rows for the trip, regardless of the limit, so the
   * client knows whether to show "and N more".
   */
  summarizeForTrip(tripId: string, ownerId: string, limit: number): Promise<TripMediaSummary>;
}

export const TRIP_MEDIA_PORT = Symbol('TRIP_MEDIA_PORT');
