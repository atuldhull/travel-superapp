'use client';

/**
 * `useSurfaceAnticipation` — wire the Phase 5 predictor into the surface
 * manager's `anticipate(id)` pre-warm socket (Phase 5 slice 3, AE597).
 *
 * The predictor + its feature contract are pure logic in
 * `@app/aether-canvas-shared`; the surface manager's `anticipate()` slot
 * lives in `@app/aether-core`. Neither knows about the other — by design
 * (canvas-shared is framework-free; aether-core stays predictor-agnostic).
 * apps/web is the consumer that depends on both, so the wiring lives here
 * (the same place `use-lifecycle-driver` wires the FSM timing).
 *
 * On every navigation the hook:
 *   1. records the surface into a bounded recency history,
 *   2. builds a `PredictionFeatureVector` from the manager state + the
 *      clock (time-of-day) + the caller's trip context,
 *   3. runs the predictor + the confidence gate, and
 *   4. pushes the actionable top pick (or `null`) into `anticipate()`.
 *
 * Flag-gated: `enabled` defaults to `NEXT_PUBLIC_FEATURE_AETHER_PHASE5`.
 * aether-core stays flag-unaware (per its own contract) — the gate lives
 * here in the consumer. When disabled the hook anticipates `null` (clears
 * any prior pre-warm) and skips the predictor entirely.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSurfaceManager } from '@app/aether-core';
import {
  actionablePrediction,
  createHeuristicSurfacePredictor,
  timeOfDayBucketFromHour,
  type ActionablePredictionOptions,
  type PredictableSurfaceId,
  type PredictionFeatureVector,
  type SurfacePredictor,
  type TripPhase,
} from '@app/aether-canvas-shared';

/** Default number of recent surfaces kept for the recency signal. */
export const DEFAULT_ANTICIPATION_HISTORY_LIMIT = 8;

/** Stable default predictor (module singleton so the hook's memo deps
 *  don't churn — a fresh `createHeuristicSurfacePredictor()` per render
 *  would re-run the prediction every frame). */
const DEFAULT_PREDICTOR: SurfacePredictor = createHeuristicSurfacePredictor();

/** Read the Phase 5 flag once. apps/web inlines `NEXT_PUBLIC_*` at build. */
const PHASE5_FLAG_ENABLED = process.env.NEXT_PUBLIC_FEATURE_AETHER_PHASE5 === '1';

/**
 * Append `surface` to the bounded recency history (newest last). A
 * consecutive duplicate (same as the last entry) returns the SAME array
 * reference so React state bails out without a re-render. The history is
 * capped to `limit` (floored to >= 1), dropping the oldest.
 */
export function pushRecentSurface(
  history: readonly PredictableSurfaceId[],
  surface: PredictableSurfaceId,
  limit: number = DEFAULT_ANTICIPATION_HISTORY_LIMIT,
): readonly PredictableSurfaceId[] {
  if (history.length > 0 && history[history.length - 1] === surface) return history;
  const cap = Number.isFinite(limit)
    ? Math.max(1, Math.floor(limit))
    : DEFAULT_ANTICIPATION_HISTORY_LIMIT;
  return [...history, surface].slice(-cap);
}

/**
 * The surface to pre-warm for a feature vector, or `null` when no
 * prediction is confident enough. Pure wrapper over the predictor + the
 * confidence gate — exported for tests + non-React callers.
 */
export function anticipationTarget(
  features: PredictionFeatureVector,
  predictor: SurfacePredictor = DEFAULT_PREDICTOR,
  options?: Partial<ActionablePredictionOptions>,
): PredictableSurfaceId | null {
  return actionablePrediction(predictor.predict(features), options)?.surface ?? null;
}

export interface UseSurfaceAnticipationOptions {
  /** Gate the predictor. Defaults to `NEXT_PUBLIC_FEATURE_AETHER_PHASE5`. */
  readonly enabled?: boolean;
  /** The predictor to run. Defaults to the shared heuristic baseline. */
  readonly predictor?: SurfacePredictor;
  /** Trip lifecycle phase (the caller knows the trip; the manager doesn't).
   *  Defaults to `'planning'`. */
  readonly tripPhase?: TripPhase;
  /** 0-based day index within the active trip, or null. Defaults to null. */
  readonly dayOfTripIndex?: number | null;
  /** Local hour [0,23] provider — injected for deterministic tests.
   *  Defaults to the real clock. */
  readonly localHour?: () => number;
  /** Recency history cap. Defaults to `DEFAULT_ANTICIPATION_HISTORY_LIMIT`. */
  readonly historyLimit?: number;
}

/**
 * Drive the surface manager's `anticipate()` from the predictor. Returns
 * the current anticipated surface (or null) for convenience. Mount once,
 * high in the Aether tree (beside the lifecycle driver).
 */
export function useSurfaceAnticipation(
  options: UseSurfaceAnticipationOptions = {},
): PredictableSurfaceId | null {
  const {
    enabled = PHASE5_FLAG_ENABLED,
    predictor = DEFAULT_PREDICTOR,
    tripPhase = 'planning',
    dayOfTripIndex = null,
    localHour = defaultLocalHour,
    historyLimit = DEFAULT_ANTICIPATION_HISTORY_LIMIT,
  } = options;

  const { current, anticipate } = useSurfaceManager();
  const currentId: PredictableSurfaceId | null = current?.id ?? null;

  // Recency history, appended whenever the route-bound surface changes.
  const [history, setHistory] = useState<readonly PredictableSurfaceId[]>([]);
  const lastIdRef = useRef<PredictableSurfaceId | null>(null);
  useEffect(() => {
    if (currentId !== null && currentId !== lastIdRef.current) {
      lastIdRef.current = currentId;
      setHistory((h) => pushRecentSurface(h, currentId, historyLimit));
    }
  }, [currentId, historyLimit]);

  // Bucket the clock per render (cheap); the prediction memo only re-runs
  // when the bucket STRING changes, not every tick.
  const timeOfDay = timeOfDayBucketFromHour(localHour());

  const target = useMemo<PredictableSurfaceId | null>(() => {
    if (!enabled) return null;
    const features: PredictionFeatureVector = {
      currentSurface: currentId,
      recentSurfaces: history,
      // dwell + dayOfTrip are MLP-reserved; the heuristic ignores them.
      dwellMsOnCurrent: 0,
      timeOfDay,
      tripPhase,
      dayOfTripIndex,
    };
    return anticipationTarget(features, predictor);
  }, [enabled, currentId, history, timeOfDay, tripPhase, dayOfTripIndex, predictor]);

  // Push the decision into the manager. When disabled, `target` is null,
  // so this clears any prior pre-warm.
  useEffect(() => {
    anticipate(target);
  }, [target, anticipate]);

  return target;
}

/** Real-clock local hour. Split out so the hook body stays pure-ish + the
 *  default is overridable in tests. */
function defaultLocalHour(): number {
  return new Date().getHours();
}
