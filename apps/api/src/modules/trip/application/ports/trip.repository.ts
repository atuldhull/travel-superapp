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
