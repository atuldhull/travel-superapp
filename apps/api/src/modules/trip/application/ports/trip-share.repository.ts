/**
 * Port for TripShare persistence. Kept narrow — the v1 surface is
 * create + resolve-by-code. Revoke / list-my-shares land in follow-up
 * slices and slot in without a port-shape change (add a method,
 * existing callers untouched).
 *
 * Installed by prompt [IV.18.2.13].
 */
import type { TripShare } from '../../domain/trip-share.entity';

export interface CreateShareInput {
  readonly tripId: string;
  readonly ownerId: string;
  readonly shareCode: string;
  readonly expiresAt: Date | null;
}

export interface TripShareRepository {
  /**
   * Insert a fresh share row. Uniqueness is enforced on `shareCode`
   * at the DB level; on the rare collision the caller should retry
   * with a freshly-generated code.
   */
  create(input: CreateShareInput): Promise<TripShare>;

  /**
   * Look up a share by its opaque code. Does NOT enforce expiry —
   * that's the use-case's job so the 404 vs 410 decision stays in
   * the application layer. Returns `null` on miss.
   */
  findByCode(code: string): Promise<TripShare | null>;

  /**
   * Soft-revoke a share by flipping `publicRead = false`. Scoped to
   * the owner so a non-owner can't revoke someone else's share even
   * if they know the code. Returns `true` iff a matching row was
   * actually touched. Callers translate `false` to 404
   * `SHARE_NOT_FOUND` (same response as a wholly unknown code) so
   * owner / non-owner / missing all collapse for the recipient.
   */
  revokeByCodeForOwner(code: string, ownerId: string): Promise<boolean>;

  /**
   * List every share (active + revoked) the given owner has minted
   * for the given trip, newest first. The use-case is responsible
   * for gating on trip ownership FIRST (so a non-owner can't even
   * enumerate that a trip has no shares); the adapter treats the
   * ownerId as a straightforward WHERE filter.
   */
  listByTripForOwner(tripId: string, ownerId: string): Promise<readonly TripShare[]>;

  /**
   * Count shares for `tripId` that are currently active — i.e.
   * `publicRead = true` AND (no expiry OR expiry in the future).
   * Used by the Social module's write gate: "if a trip has at
   * least one active share, its owner has published it for
   * collaboration, so any authed user can vote on it." Owner-
   * scoping is intentionally absent — the Social use-case has
   * already decided the caller isn't the owner and is probing
   * whether the trip is share-open. [IV.18.12.3]
   */
  countActiveSharesForTrip(tripId: string): Promise<number>;
}

export const TRIP_SHARE_REPOSITORY = Symbol('TripShareRepository');
