/**
 * Port for SosEvent persistence. Three operations: create (with
 * PostGIS coord), list-mine, resolve-one-I-own.
 *
 * Resolve is scoped to `(id, userId)` — a stranger who guesses a
 * cuid can't mark someone else's SOS resolved. Returns `false` on
 * miss (either wrong id OR wrong owner) and the use-case maps it
 * to 404 `SOS_NOT_FOUND`. Same IDOR-defence policy as Trip
 * CRUD endpoints.
 *
 * Installed by prompt [IV.18.11.2].
 */
import type { SosEvent } from '../../domain/sos-event.entity';

export interface CreateSosInput {
  readonly userId: string;
  readonly trigger: string;
  readonly lat: number;
  readonly lng: number;
}

export interface ResolveSosInput {
  readonly id: string;
  readonly userId: string;
  readonly note: string | null;
}

/**
 * Admin-side filters for the SOS dashboard ([IV.18.18.2]).
 * `status: 'active'` = `resolvedAt IS NULL`; `status: 'resolved'`
 * = `resolvedAt IS NOT NULL`; absent = both. The dashboard
 * defaults to active in the controller because that's the
 * actionable triage queue.
 */
export type AdminSosListStatus = 'active' | 'resolved';

export interface AdminSosListInput {
  readonly status?: AdminSosListStatus;
  readonly limit: number;
  readonly offset: number;
}

export interface AdminSosListResult {
  readonly rows: readonly SosEvent[];
  readonly total: number;
}

export interface AdminResolveSosInput {
  readonly id: string;
  readonly note: string | null;
}

export interface SosEventRepository {
  create(input: CreateSosInput): Promise<SosEvent>;
  /**
   * Most-recent-first list of the caller's own events. Includes
   * both active and resolved.
   */
  listForUser(userId: string, limit: number): Promise<readonly SosEvent[]>;
  /**
   * Flip `resolvedAt = now()` on the matching row. Scoped to
   * owner + still-unresolved — so a repeat resolve (or a stranger's
   * resolve) returns `null`, which the use-case maps to 404.
   */
  resolve(input: ResolveSosInput): Promise<SosEvent | null>;
  /**
   * Admin paginated list across ALL users — drives the SOS
   * triage dashboard. Filter by `status` to narrow to active or
   * resolved events. Returns `{ rows, total }` so the UI can
   * render "Showing N of M". Most-recent-first.
   *
   * Added by `[IV.18.18.2]` for the admin SOS dashboard.
   */
  adminList(input: AdminSosListInput): Promise<AdminSosListResult>;
  /**
   * Admin-driven resolve. Same `updateMany + count === 1` gate
   * as the user `resolve` method but without the `userId`
   * scope — lets ops mark someone else's SOS resolved (e.g. a
   * support agent confirms with the user out-of-band that
   * they're safe). The `resolvedAt: null` clause keeps it
   * idempotent: a repeat resolve returns `null` → 404.
   *
   * Added by `[IV.18.18.2]`.
   */
  adminResolve(input: AdminResolveSosInput): Promise<SosEvent | null>;
}

export const SOS_EVENT_REPOSITORY = Symbol('SosEventRepository');
