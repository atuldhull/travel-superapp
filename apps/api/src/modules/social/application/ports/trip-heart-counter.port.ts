/**
 * Port for the anonymous shared-trip heart counter.
 *
 * The heart use-case + the shared-trip-react controller depend on
 * this; the Redis-backed `TripHeartCounter` (infrastructure)
 * implements it (CLAUDE.md #10).
 *
 * Extracted by prompt [A1-burndown].
 */
export interface TripHeartCounterPort {
  /** Atomically bump the trip's heart count; returns the new total. */
  increment(tripId: string): Promise<number>;
  /** Read the current heart count (0 when never hearted). */
  get(tripId: string): Promise<number>;
}

/** Nest DI token. */
export const TRIP_HEART_COUNTER_PORT = Symbol('TripHeartCounterPort');
