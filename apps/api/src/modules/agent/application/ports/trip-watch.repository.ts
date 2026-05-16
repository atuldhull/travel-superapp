/**
 * POST.2A.2 — port for TripWatch persistence.
 *
 * `findActiveByTrip` backs the "at most one active watch per trip"
 * domain invariant enforced in StartTripWatchUseCase. Bound to a
 * Prisma adapter when the DB is unblocked (deferred from POST.2A.2).
 *
 * Installed by prompt [POST.2A.2].
 */
import type { SignalKind, TripWatch } from '../../domain/trip-watch.entity';

export interface CreateTripWatchInput {
  readonly tripId: string;
  readonly agentRunId: string;
  readonly subscribedSignals: readonly SignalKind[];
  readonly thresholds: Readonly<Record<string, number>>;
}

export interface TripWatchRepository {
  create(input: CreateTripWatchInput): Promise<TripWatch>;
  /** The single active watch for a trip, or null. */
  findActiveByTrip(tripId: string): Promise<TripWatch | null>;
  /** All active watches — the scheduler's work list (POST.2A.3). */
  listActive(): Promise<readonly TripWatch[]>;
}

export const TRIP_WATCH_REPOSITORY = Symbol('TripWatchRepository');
