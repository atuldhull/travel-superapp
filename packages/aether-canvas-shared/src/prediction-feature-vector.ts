/**
 * `prediction-feature-vector` — the typed contract of client-side
 * signals the Phase 5 surface predictor consumes (AE585).
 *
 * The predictor (heuristic now, MLP later) reads a `PredictionFeatureVector`
 * and ranks the user's likely next surface. Everything here is derivable
 * from a single client session WITHOUT a server round-trip — the same
 * vector the future MLP will be trained on, so the feature contract is
 * stable across the heuristic→model swap.
 *
 * Pure + framework-free: no React, no DOM, no clock reads. Callers pass
 * `nowMs` / `localHour` in so the helpers stay deterministic + testable
 * (mirrors how the Mirror + Now-Card helpers take an injected clock).
 */
import type { PredictableSurfaceId } from './predictable-surface';

/** Coarse time-of-day band. Drives the time-of-day surface bias (people
 *  plan in the morning, relive memories at night). */
export type TimeOfDayBucket = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';

/** Where the user sits in a trip's lifecycle. Drives the trip-phase
 *  surface bias (planning → Atlas/Vault; in-trip → Compass/Genie;
 *  post-trip → Lumen/Echo). */
export type TripPhase = 'planning' | 'pre-trip' | 'in-trip' | 'post-trip';

/** The signal bundle the predictor scores. All fields are optional-safe:
 *  a cold-start session (no current surface, empty history) is valid and
 *  the heuristic falls back to time + trip bias. */
export interface PredictionFeatureVector {
  /** The surface the user is on right now, or `null` at app cold-start. */
  readonly currentSurface: PredictableSurfaceId | null;
  /** Recent surface history, OLDEST first / NEWEST last. May be empty.
   *  Used for the recency penalty (don't predict where they just were)
   *  and, later, sequence features for the MLP. */
  readonly recentSurfaces: readonly PredictableSurfaceId[];
  /** Milliseconds the user has dwelt on `currentSurface`. Negative /
   *  non-finite values are treated as 0. */
  readonly dwellMsOnCurrent: number;
  /** Coarse local time-of-day band. */
  readonly timeOfDay: TimeOfDayBucket;
  /** Trip lifecycle phase. */
  readonly tripPhase: TripPhase;
  /** 0-based day index within the active trip, or `null` when not on a
   *  trip (planning / post-trip). */
  readonly dayOfTripIndex: number | null;
}

/**
 * Map a local hour (0-23) to a `TimeOfDayBucket`.
 *   dawn 5-7 · morning 8-11 · afternoon 12-16 · evening 17-20 · night 21-4
 * Non-finite or out-of-range hours wrap into [0,24) so a bad clock never
 * throws (it just lands in some band).
 */
export function timeOfDayBucketFromHour(hour: number): TimeOfDayBucket {
  if (!Number.isFinite(hour)) return 'morning';
  // Wrap into [0,24): handles negatives + >=24 without throwing.
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= 5 && h <= 7) return 'dawn';
  if (h >= 8 && h <= 11) return 'morning';
  if (h >= 12 && h <= 16) return 'afternoon';
  if (h >= 17 && h <= 20) return 'evening';
  return 'night';
}

/**
 * Derive the `TripPhase` from a trip's start/end day-offsets relative to
 * "today". `dayIndex` is today's 0-based offset from the trip start
 * (negative = before the trip, 0..lastDay = during, > lastDay = after).
 * `lastDayIndex` is the 0-based index of the final trip day (must be
 * >= 0; a non-finite value falls back to 0).
 *
 * A `null` dayIndex (no active trip) is the planning phase.
 */
export function tripPhaseFromDayIndex(dayIndex: number | null, lastDayIndex: number): TripPhase {
  if (dayIndex === null || !Number.isFinite(dayIndex)) return 'planning';
  // Sanitise lastDayIndex too: a non-finite value (trip with no end date)
  // would make `dayIndex <= NaN` always false and silently misclassify a
  // genuine in-trip day as post-trip (AE590).
  const last = Number.isFinite(lastDayIndex) ? Math.max(0, Math.floor(lastDayIndex)) : 0;
  if (dayIndex < -1) return 'planning';
  if (dayIndex < 0) return 'pre-trip';
  if (dayIndex <= last) return 'in-trip';
  return 'post-trip';
}

/** Normalise a raw dwell reading to a safe, non-negative number of ms. */
export function safeDwellMs(dwellMs: number): number {
  return Number.isFinite(dwellMs) && dwellMs > 0 ? dwellMs : 0;
}

/**
 * How recently `surface` appears in `recentSurfaces` (NEWEST last).
 * Returns 0 for the most-recent entry, 1 for the next, … and
 * `Infinity` when `surface` is absent. Used by the recency penalty.
 */
export function recencyRank(
  surface: PredictableSurfaceId,
  recentSurfaces: readonly PredictableSurfaceId[],
): number {
  for (let i = recentSurfaces.length - 1, rank = 0; i >= 0; i--, rank++) {
    if (recentSurfaces[i] === surface) return rank;
  }
  return Infinity;
}
