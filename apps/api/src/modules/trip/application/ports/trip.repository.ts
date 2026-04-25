/**
 * Port for Trip persistence. Adapters go through `GeoQueries` for the
 * `center` column (Playbook CLAUDE rule 11).
 *
 * Installed by prompt [IV.18.2.3].
 */
import type { Trip, TripStatus } from '../../domain/trip.entity';

export interface CreateTripDraftInput {
  readonly userId: string;
  readonly title: string;
  readonly lat: number;
  readonly lng: number;
  readonly radiusKm: number;
  readonly startsOn?: Date | null;
  readonly endsOn?: Date | null;
}

export interface TripRepository {
  /**
   * Insert a Trip row in `draft` status. `center` is persisted via
   * `GeoQueries.insertTrip`; all other fields map 1:1 from `input`.
   */
  createDraft(input: CreateTripDraftInput): Promise<Trip>;

  /** Fetch a trip by id, scoped to a user so one user can't read
   *  another's trip just by guessing the cuid. Returns `null` if no
   *  row matches or the trip belongs to a different user. */
  findByIdForUser(id: string, userId: string): Promise<Trip | null>;

  /** Simple listing for the user's own trips — descending by
   *  `createdAt`, capped by the caller. */
  listByUser(userId: string, limit: number): Promise<readonly Trip[]>;

  /** Used by tests + a future admin flow. No production endpoint calls
   *  this yet. */
  updateStatus(id: string, status: TripStatus): Promise<void>;

  /**
   * Apply a partial update to a trip the caller owns. Returns the
   * updated row, or `null` if no row matches (trip missing OR owned
   * by a different user — the single signal lets the use-case 404).
   */
  updateForUser(id: string, userId: string, patch: UpdateTripPatch): Promise<Trip | null>;

  /**
   * Delete a trip the caller owns. Returns `true` iff a row was
   * actually removed (missing / wrong-owner → false, mapped to 404).
   * Cascade via Prisma handles ItineraryDay + ItineraryItem +
   * TripVersion + Share rows.
   */
  deleteForUser(id: string, userId: string): Promise<boolean>;

  /**
   * Admin paginated list across ALL users — drives the trip
   * moderation queue. Returns `{ rows, total }`. Filters: `q`
   * (case-insensitive substring on `title`), `status` (single
   * TripStatus value). Most-recent-first ordering. Added by
   * `[IV.18.18.3]`.
   */
  adminList(input: AdminTripListInput): Promise<AdminTripListResult>;

  /**
   * Admin archive — flips `status = 'archived'` regardless of
   * owner. Returns `true` when a row was matched (idempotent
   * — re-archiving an already-archived trip still returns `true`).
   * Returns `false` only when the trip row is missing.
   * Added by `[IV.18.18.3]`.
   */
  adminArchive(id: string): Promise<boolean>;

  /**
   * Admin hard-delete (no owner scope). Cascades to itinerary
   * days + items + votes + expenses + reviews + media via
   * Prisma's `onDelete: Cascade`. Returns `true` iff a row was
   * actually removed. Added by `[IV.18.18.3]`.
   */
  adminDelete(id: string): Promise<boolean>;
}

export interface AdminTripListInput {
  readonly q?: string;
  readonly status?: TripStatus;
  readonly limit: number;
  readonly offset: number;
}

export interface AdminTripListResult {
  readonly rows: readonly Trip[];
  readonly total: number;
}

/**
 * Subset of Trip that PATCH /trips/:id can mutate. Center lat/lng
 * is intentionally EXCLUDED — PostGIS `center` changes need the raw-
 * SQL path and would reshape the itinerary entirely. Users who want
 * a different location delete + create a new trip.
 */
export interface UpdateTripPatch {
  readonly title?: string;
  readonly radiusKm?: number;
  readonly startsOn?: Date | null;
  readonly endsOn?: Date | null;
}

export const TRIP_REPOSITORY = Symbol('TripRepository');
