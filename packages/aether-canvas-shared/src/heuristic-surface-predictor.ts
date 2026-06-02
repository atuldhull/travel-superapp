/**
 * `heuristic-surface-predictor` — the baseline `SurfacePredictor` (AE587).
 *
 * Phase 5's "Predictive" tier ships an MLP trained on production
 * telemetry — but that needs a live app accumulating data, which doesn't
 * exist yet. This heuristic is the baseline that ships value NOW and that
 * the MLP later replaces behind the `SurfacePredictor` interface (same
 * seam, no consumer change). It is also the obvious fallback when the
 * model is cold or low-confidence.
 *
 * It blends three hand-authored signals into a per-surface weight, then
 * applies a recency penalty so it doesn't predict the surface you're
 * already on (or just left):
 *
 *   weight(to) = priorWeight · transitionPrior(from → to)
 *              + tripWeight  · tripPhaseBias(phase → to)
 *              + timeWeight  · timeOfDayBias(timeOfDay → to)
 *   weight(to) *= recencyPenalty(how-recently-`to`-was-visited)
 *
 * With no current surface (cold start) the transition term is simply 0,
 * so the predictor degrades to a sensible time + trip-phase guess. The
 * shared `rankPredictions` tail normalises + sorts the result.
 *
 * Pure + framework-free + deterministic: same feature vector → same
 * ranking.
 */
import { NAVIGABLE_SURFACES, type PredictableSurfaceId } from './predictable-surface';
import {
  recencyRank,
  type PredictionFeatureVector,
  type TimeOfDayBucket,
  type TripPhase,
} from './prediction-feature-vector';
import {
  rankPredictions,
  type SurfacePrediction,
  type SurfacePredictor,
} from './surface-predictor';

type SurfaceWeights = Partial<Record<PredictableSurfaceId, number>>;

/** from-surface → likely next surface, hand-authored from the intended
 *  product flows (drift→plan, atlas→book, lumen→share, …). `pulse` is
 *  never a "from" (it is an overlay) so it has no row. Self-transitions
 *  are omitted — the recency penalty handles "staying put". */
export const SURFACE_TRANSITION_PRIORS: Partial<Record<PredictableSurfaceId, SurfaceWeights>> = {
  drift: { atlas: 4, compass: 3, echo: 3, lumen: 2, vault: 1 },
  atlas: { vault: 4, compass: 3, genie: 2, lumen: 2, continuum: 1 },
  compass: { atlas: 4, continuum: 3, genie: 2, drift: 1 },
  continuum: { compass: 3, atlas: 3, vault: 1 },
  vault: { atlas: 4, continuum: 2, compass: 1 },
  lumen: { echo: 4, atlas: 2, drift: 1 },
  echo: { atlas: 3, lumen: 3, drift: 2 },
  genie: { atlas: 3, compass: 2, vault: 2 },
  mirror: { drift: 1 },
};

/** time-of-day → surface bias: plan in the morning, relive at night. */
export const TIME_OF_DAY_SURFACE_BIAS: Record<TimeOfDayBucket, SurfaceWeights> = {
  dawn: { drift: 2, atlas: 2, compass: 1 },
  morning: { atlas: 3, compass: 2, vault: 1 },
  afternoon: { compass: 2, genie: 2, vault: 1, atlas: 1 },
  evening: { lumen: 3, echo: 2, continuum: 1 },
  // mirror (admin audit forensics) gets a weak off-hours signal so the
  // admin surface is reachable by the predictor at all — without it,
  // mirror is a candidate that can never be ranked in any state (AE590).
  night: { lumen: 2, echo: 2, drift: 1, mirror: 1 },
};

/** trip-phase → surface bias: planning leans Atlas/Vault, in-trip leans
 *  Compass/Genie, post-trip leans Lumen/Echo. */
export const TRIP_PHASE_SURFACE_BIAS: Record<TripPhase, SurfaceWeights> = {
  planning: { atlas: 3, vault: 2, drift: 1, echo: 1 },
  'pre-trip': { atlas: 2, vault: 2, continuum: 2, compass: 1 },
  'in-trip': { compass: 3, genie: 2, continuum: 1, lumen: 1 },
  'post-trip': { lumen: 3, echo: 2, atlas: 1 },
};

/** Tunable blend weights + candidate set. Defaults weight the transition
 *  prior highest (strongest signal when we know the current surface),
 *  then trip phase, then time of day. */
export interface HeuristicPredictorConfig {
  readonly priorWeight: number;
  readonly tripWeight: number;
  readonly timeWeight: number;
  /** Per-step recency penalty inputs (see `recencyPenalty`). */
  readonly recencyFloor: number;
  readonly recencyStep: number;
  /** Which surfaces are scored. Defaults to `NAVIGABLE_SURFACES`. */
  readonly candidates: readonly PredictableSurfaceId[];
}

export const DEFAULT_HEURISTIC_CONFIG: HeuristicPredictorConfig = {
  priorWeight: 1.0,
  tripWeight: 0.6,
  timeWeight: 0.4,
  recencyFloor: 0.15,
  recencyStep: 0.25,
  candidates: NAVIGABLE_SURFACES,
};

/**
 * Penalty multiplier for a candidate by how recently it was visited.
 * `rank` is the output of `recencyRank` (0 = most recent, … , Infinity =
 * not in history). The most-recent surface is suppressed hardest;
 * the penalty relaxes linearly with distance and is capped at 1
 * (no penalty) for surfaces not visited recently.
 */
export function recencyPenalty(rank: number, floor: number, step: number): number {
  if (!Number.isFinite(rank)) return 1;
  const raw = floor + step * rank;
  // Clamp into [0,1]; a non-finite raw (bad floor/step override) degrades
  // to "no penalty" so a candidate is never silently deleted by a
  // negative / NaN multiplier (AE590).
  return Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 1;
}

function bias(table: SurfaceWeights, surface: PredictableSurfaceId): number {
  const v = table[surface];
  return Number.isFinite(v) && (v as number) > 0 ? (v as number) : 0;
}

/**
 * Build a heuristic `SurfacePredictor`. Optionally override any blend
 * weight / recency input / candidate set; omitted fields fall back to
 * `DEFAULT_HEURISTIC_CONFIG`.
 */
export function createHeuristicSurfacePredictor(
  config: Partial<HeuristicPredictorConfig> = {},
): SurfacePredictor {
  const cfg: HeuristicPredictorConfig = { ...DEFAULT_HEURISTIC_CONFIG, ...config };

  const predict = (features: PredictionFeatureVector): SurfacePrediction[] => {
    // dwellMsOnCurrent + dayOfTripIndex are part of the feature contract
    // but intentionally UNUSED by the heuristic — they are reserved as
    // training inputs for the future MLP (which implements this same
    // interface). Changing either must not move the heuristic's ranking.
    const { currentSurface, recentSurfaces, timeOfDay, tripPhase } = features;

    const priorRow: SurfaceWeights =
      currentSurface !== null ? (SURFACE_TRANSITION_PRIORS[currentSurface] ?? {}) : {};
    const timeRow = TIME_OF_DAY_SURFACE_BIAS[timeOfDay] ?? {};
    const tripRow = TRIP_PHASE_SURFACE_BIAS[tripPhase] ?? {};

    // Effective history newest-last, with the current surface appended so
    // a candidate == current gets the rank-0 (strongest) suppression —
    // but only when recentSurfaces doesn't ALREADY end in current.
    // Otherwise the append double-lists current + shifts every older
    // entry's recency rank up by one, under-suppressing the surface
    // visited one step ago (AE590).
    const endsInCurrent =
      recentSurfaces.length > 0 && recentSurfaces[recentSurfaces.length - 1] === currentSurface;
    const effectiveRecent: PredictableSurfaceId[] =
      currentSurface !== null && !endsInCurrent
        ? [...recentSurfaces, currentSurface]
        : [...recentSurfaces];

    const weights = new Map<PredictableSurfaceId, number>();
    for (const surface of cfg.candidates) {
      const base =
        cfg.priorWeight * bias(priorRow, surface) +
        cfg.tripWeight * bias(tripRow, surface) +
        cfg.timeWeight * bias(timeRow, surface);
      if (base <= 0) continue;
      const penalty = recencyPenalty(
        recencyRank(surface, effectiveRecent),
        cfg.recencyFloor,
        cfg.recencyStep,
      );
      weights.set(surface, base * penalty);
    }

    return rankPredictions(weights);
  };

  return { predict };
}
