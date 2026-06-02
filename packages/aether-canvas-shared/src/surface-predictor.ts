/**
 * `surface-predictor` — the predictor SEAM (AE586).
 *
 * This is the Phase 5 equivalent of the Phase 4 palette seam: a stable
 * interface with a swappable implementation. Today the only implementation
 * is the pure heuristic (`createHeuristicSurfacePredictor`); when the MLP
 * is trained from production telemetry it implements this SAME interface
 * and drops in behind it — no consumer changes, because both return a
 * ranked `SurfacePrediction[]` for the same `PredictionFeatureVector`.
 *
 * Pure + framework-free. A consumer (a React hook in `@app/aether-core`,
 * a later slice) calls `predict(features)`, takes the actionable top
 * prediction via `prediction-confidence`, and feeds it to the surface
 * manager's already-present `anticipate(id)` socket for pre-warming.
 */
import type { PredictableSurfaceId } from './predictable-surface';
import type { PredictionFeatureVector } from './prediction-feature-vector';

/** A single ranked prediction. `score` is normalised to [0,1] across the
 *  returned set (the scores of a full result sum to 1, so `score` reads
 *  as "share of confidence"). */
export interface SurfacePrediction {
  readonly surface: PredictableSurfaceId;
  readonly score: number;
}

/**
 * The predictor contract. `predict` returns predictions sorted by
 * descending `score` (most-likely first). Implementations MUST be pure
 * w.r.t. the feature vector (same vector → same ranking) so the output
 * is testable + cacheable, and MUST emit normalised scores (sum to 1) —
 * the simplest way is to route the final weights through
 * `rankPredictions` (the heuristic does). The confidence gate's absolute
 * `minScore` floor is only meaningful if the scores are a normalised
 * share, so a future MLP must normalise (or route through
 * `rankPredictions`) before returning.
 */
export interface SurfacePredictor {
  readonly predict: (features: PredictionFeatureVector) => SurfacePrediction[];
}

/**
 * Turn a raw `surface → weight` map into a normalised, descending-sorted
 * `SurfacePrediction[]`. The shared tail every predictor implementation
 * uses so they all emit the same normalised, deterministically-ordered
 * shape.
 *
 * - Negative / non-finite weights are floored to 0.
 * - If every weight is 0 (or the map is empty) the result is an EMPTY
 *   array — "no signal" — which `prediction-confidence` reads as
 *   not-actionable rather than inventing a uniform guess.
 * - Ties break by the surface id (ascending) so the order is total +
 *   stable across runs.
 */
export function rankPredictions(
  weights: ReadonlyMap<PredictableSurfaceId, number>,
): SurfacePrediction[] {
  const safe: Array<[PredictableSurfaceId, number]> = [];
  let total = 0;
  for (const [surface, weight] of weights) {
    const w = Number.isFinite(weight) && weight > 0 ? weight : 0;
    if (w > 0) {
      safe.push([surface, w]);
      total += w;
    }
  }
  // Guard the SUM too, not just each weight: two finite-but-huge weights
  // (a future MLP's logits) can overflow to Infinity, which would make
  // every `w / total` 0 and break the sum-to-1 contract. Non-finite or
  // non-positive total => no usable signal => empty (AE590).
  if (!Number.isFinite(total) || total <= 0) return [];
  return safe
    .map(([surface, w]) => ({ surface, score: w / total }))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.surface < b.surface ? -1 : 1));
}
