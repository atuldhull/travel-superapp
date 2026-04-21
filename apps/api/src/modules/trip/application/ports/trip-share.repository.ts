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
}

export const TRIP_SHARE_REPOSITORY = Symbol('TripShareRepository');
