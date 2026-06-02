/**
 * `prediction-confidence` — when is a prediction strong enough to act on?
 * (AE588)
 *
 * Pre-warming the wrong surface wastes a GL context + memory, so the
 * consumer should only call the surface manager's `anticipate(id)` when
 * the top prediction is BOTH confident in absolute terms AND clearly
 * ahead of the runner-up. This module is that gate — pure, so the policy
 * is testable in isolation from the predictor + the React wiring.
 *
 *   actionable = top.score >= minScore  AND  (top.score - second.score) >= minMargin
 *
 * A weak field (every surface ~equally likely) yields `null` → don't
 * anticipate. The empty/no-signal result from the predictor also yields
 * `null`.
 */
import type { SurfacePrediction } from './surface-predictor';

/** Default absolute-confidence floor: the top surface must hold at least
 *  this share of normalised confidence. */
export const DEFAULT_PREDICTION_MIN_SCORE = 0.34;

/** Default lead the top prediction must hold over the runner-up. Stops
 *  pre-warming on a near-tie. */
export const DEFAULT_PREDICTION_MIN_MARGIN = 0.12;

export interface ActionablePredictionOptions {
  readonly minScore: number;
  readonly minMargin: number;
}

export const DEFAULT_ACTIONABLE_OPTIONS: ActionablePredictionOptions = {
  minScore: DEFAULT_PREDICTION_MIN_SCORE,
  minMargin: DEFAULT_PREDICTION_MIN_MARGIN,
};

/**
 * Return the top prediction IFF it clears both the absolute-score floor
 * and the margin-over-runner-up; otherwise `null`.
 *
 * - Empty `predictions` (or all non-finite) → `null`.
 * - A single finite prediction → actionable iff it clears `minScore`;
 *   with no runner-up the margin test is skipped (passes vacuously,
 *   regardless of `minMargin`).
 * - Non-finite (NaN / Infinity) scores are ignored, and the scan reads
 *   the max two FINITE scores rather than trusting index order — so the
 *   result is permutation-independent even on unsorted input and a bad
 *   MLP score can never be returned as the actionable pick.
 */
export function actionablePrediction(
  predictions: readonly SurfacePrediction[],
  options: Partial<ActionablePredictionOptions> = {},
): SurfacePrediction | null {
  const { minScore, minMargin } = { ...DEFAULT_ACTIONABLE_OPTIONS, ...options };

  let top: SurfacePrediction | null = null;
  let secondScore = 0;
  let hasSecond = false;
  for (const p of predictions) {
    if (!Number.isFinite(p.score)) continue;
    if (top === null || p.score > top.score) {
      if (top !== null) {
        secondScore = top.score;
        hasSecond = true;
      }
      top = p;
    } else if (!hasSecond || p.score > secondScore) {
      secondScore = p.score;
      hasSecond = true;
    }
  }
  if (top === null) return null;

  if (top.score < minScore) return null;
  // Margin test applies only when a runner-up exists; a lone prediction
  // passes it vacuously (AE590).
  if (hasSecond && top.score - secondScore < minMargin) return null;
  return top;
}

/** Convenience: is there an actionable prediction at all? */
export function hasActionablePrediction(
  predictions: readonly SurfacePrediction[],
  options: Partial<ActionablePredictionOptions> = {},
): boolean {
  return actionablePrediction(predictions, options) !== null;
}
