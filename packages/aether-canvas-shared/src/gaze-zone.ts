/**
 * `gaze-zone` — map a normalised gaze point to a coarse 3×3 screen zone
 * (Phase 5, AE592).
 *
 * Raw gaze (x,y ∈ [0,1]) is too jittery to drive UI directly; surfaces
 * react to a coarse zone instead ("the user is looking at the top-right →
 * surface the upcoming-trip card there"). Pure: a deterministic bucketing
 * with no smoothing state (the recognizer + confidence gate handle
 * stability elsewhere).
 */
import { isConfidentGaze, MIN_GAZE_CONFIDENCE, type GazePoint } from './perception-frame';

/** One of nine coarse screen zones (row-major: top → bottom). */
export type GazeZone =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'center'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right';

/** Row-major zone names, indexed `row * 3 + col` (row 0 = top, col 0 = left). */
const GAZE_ZONES: readonly GazeZone[] = [
  'top-left',
  'top',
  'top-right',
  'left',
  'center',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
];

/** Bucket a unit coordinate into a third index 0/1/2. Clamps to [0,1] so
 *  out-of-range input never indexes past the grid; exactly 1 → 2; a
 *  non-finite axis lands in the centre third. */
function thirdIndex(v: number): 0 | 1 | 2 {
  const c = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5;
  if (c < 1 / 3) return 0;
  if (c < 2 / 3) return 1;
  return 2;
}

/**
 * Map raw (x, y) coordinates to a `GazeZone`. Pure + total: non-finite or
 * out-of-range coordinates clamp into the grid.
 */
export function gazeZone(x: number, y: number): GazeZone {
  const index = thirdIndex(y) * 3 + thirdIndex(x);
  return GAZE_ZONES[index] ?? 'center';
}

/**
 * The zone a gaze point falls in, or `null` when the gaze is absent /
 * low-confidence (so a caller never reacts to an unreliable reading).
 */
export function gazeZoneOf(
  gaze: GazePoint | null,
  minConfidence: number = MIN_GAZE_CONFIDENCE,
): GazeZone | null {
  if (!isConfidentGaze(gaze, minConfidence)) return null;
  return gazeZone(gaze.x, gaze.y);
}
