/**
 * `perception-frame` — the framework-free mirror of the perception
 * contract canonicalised in `@app/aether-core` (`./perception.tsx`),
 * plus pure confidence / staleness helpers (Phase 5, AE591).
 *
 * Perception (gaze + gesture) ships its React surface — `PerceptionProvider`
 * / `usePerception()` — in aether-core. But that file imports from `react`,
 * so importing its types into canvas-shared (consumed by apps/mobile)
 * would transit the React-19 JSX barrel and clash with apps/mobile's
 * React-18 @types (see surface-lifecycle-phase.ts). So we mirror the
 * pure types here — `GazePoint` / `Gesture` / `GestureEvent` /
 * `PerceptionState` — so the predictor, the gaze/gesture helpers, the
 * deterministic mock, and the future mediapipe implementation all share
 * one framework-free contract. The two copies are structurally identical
 * by construction, so a `PerceptionState` built here drops straight into
 * `<PerceptionProvider state={...}>`.
 */

/** Normalised gaze position in viewport space: x ∈ [0,1], y ∈ [0,1]. */
export interface GazePoint {
  readonly x: number;
  readonly y: number;
  /** Confidence ∈ [0,1]. < 0.5 means use with skepticism. */
  readonly confidence: number;
  /** ms since epoch — for staleness checks. */
  readonly capturedAt: number;
}

/** Discrete gestures the system detects. Phase 5 may expand this list;
 *  keep `PERCEPTION_GESTURES` in step. */
export type Gesture = 'open-palm' | 'pinch' | 'wave' | 'point';

/** The frozen runtime list of every `Gesture` — for iteration + the mock. */
export const PERCEPTION_GESTURES: readonly Gesture[] = Object.freeze([
  'open-palm',
  'pinch',
  'wave',
  'point',
]);

export interface GestureEvent {
  readonly gesture: Gesture;
  readonly confidence: number;
  readonly capturedAt: number;
}

/** A single perception reading. Mirror of aether-core's `PerceptionState`. */
export interface PerceptionState {
  /** Most recent gaze point, or null if perception is off / unavailable. */
  readonly gaze: GazePoint | null;
  /** Most recent gesture event, or null. */
  readonly gesture: GestureEvent | null;
  /** True iff perception is actively running (camera + processing). */
  readonly active: boolean;
}

/** The "nothing perceived" frame — perception off, no gaze, no gesture. */
export const IDLE_PERCEPTION_STATE: PerceptionState = Object.freeze({
  gaze: null,
  gesture: null,
  active: false,
});

/** Gaze older than this (ms) is stale — a camera at ~30fps refreshes
 *  every ~33ms, so 400ms means "the last dozen frames produced nothing". */
export const DEFAULT_GAZE_TTL_MS = 400;

/** Below this confidence, a gaze point is treated as unreliable. */
export const MIN_GAZE_CONFIDENCE = 0.5;

/** Below this confidence, a gesture event is ignored. */
export const MIN_GESTURE_CONFIDENCE = 0.6;

/** Is `v` a finite value in the unit interval [0,1]? Used for both
 *  coordinates AND confidence — a confidence of `5` or `1e9` is
 *  out-of-contract garbage and must NOT read as maximally confident. */
function isUnit01(v: number): boolean {
  return Number.isFinite(v) && v >= 0 && v <= 1;
}

/**
 * Is this gaze point usable — present, in-bounds, and confident enough?
 * `null` gaze is never confident; a super-unit / non-finite confidence is
 * rejected (not treated as confident).
 */
export function isConfidentGaze(
  gaze: GazePoint | null,
  minConfidence: number = MIN_GAZE_CONFIDENCE,
): gaze is GazePoint {
  return (
    gaze !== null &&
    isUnit01(gaze.x) &&
    isUnit01(gaze.y) &&
    isUnit01(gaze.confidence) &&
    gaze.confidence >= minConfidence
  );
}

/**
 * Is this gaze point older than `ttlMs` relative to `now`? A `null` gaze
 * or a non-finite timestamp is treated as stale (unusable).
 */
export function isGazeStale(
  gaze: GazePoint | null,
  now: number,
  ttlMs: number = DEFAULT_GAZE_TTL_MS,
): boolean {
  if (gaze === null || !Number.isFinite(gaze.capturedAt) || !Number.isFinite(now)) return true;
  return now - gaze.capturedAt > ttlMs;
}

/** Is this gesture event present + confident enough to act on? */
export function isConfidentGesture(
  event: GestureEvent | null,
  minConfidence: number = MIN_GESTURE_CONFIDENCE,
): event is GestureEvent {
  return event !== null && isUnit01(event.confidence) && event.confidence >= minConfidence;
}
