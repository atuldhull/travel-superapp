/**
 * `gesture-recognizer` — debounce raw per-frame gesture detections into a
 * single "fired" event (Phase 5, AE594).
 *
 * mediapipe emits a gesture guess every camera frame (~30/s); acting on
 * each frame would fire a "pinch" a dozen times for one real pinch and
 * flicker on noise. This pure reducer requires a gesture to be detected
 * (above confidence) on `holdFrames` CONSECUTIVE frames before it fires,
 * and fires it exactly ONCE — it won't re-fire until the gesture changes
 * or drops, then is held again.
 *
 * Pure + deterministic: `advanceGestureRecognizer(state, event)` → next
 * state. The caller folds it over the frame stream and reacts whenever
 * `fired !== null`. Same shape as the Genie FSM (genie-state).
 */
import {
  isConfidentGesture,
  MIN_GESTURE_CONFIDENCE,
  type Gesture,
  type GestureEvent,
} from './perception-frame';

export interface GestureRecognizerState {
  /** The gesture currently being held (above confidence), or null. */
  readonly candidate: Gesture | null;
  /** Consecutive confident frames `candidate` has been seen (capped just
   *  past the threshold so the state stays bounded). */
  readonly heldFrames: number;
  /** The gesture that FIRED on the step that produced this state, or null.
   *  Non-null on exactly one step per hold. */
  readonly fired: Gesture | null;
  /** Latch: has the CURRENT hold already fired? Set on the firing frame,
   *  cleared on any reset (drop / change / low confidence). Makes
   *  fire-once robust even if `holdFrames` is changed mid-hold — the
   *  decision is "crossed the threshold and not yet fired", not a fragile
   *  `held === threshold` equality. */
  readonly hasFired: boolean;
}

/** Fresh recogniser state — nothing held, nothing fired. */
export const INITIAL_GESTURE_RECOGNIZER_STATE: GestureRecognizerState = Object.freeze({
  candidate: null,
  heldFrames: 0,
  fired: null,
  hasFired: false,
});

/** Default consecutive-frame hold before a gesture fires (~100ms @ 30fps). */
export const DEFAULT_GESTURE_HOLD_FRAMES = 3;

export interface GestureRecognizerOptions {
  /** Consecutive confident frames required before firing (min 1). */
  readonly holdFrames: number;
  /** Confidence floor a frame's gesture must clear to count. */
  readonly minConfidence: number;
}

export const DEFAULT_GESTURE_RECOGNIZER_OPTIONS: GestureRecognizerOptions = {
  holdFrames: DEFAULT_GESTURE_HOLD_FRAMES,
  minConfidence: MIN_GESTURE_CONFIDENCE,
};

/**
 * Advance the recogniser by one frame. `event` is the frame's gesture
 * detection (or null if none / between gestures).
 *
 * - A low-confidence event counts as "no gesture" (resets the hold).
 * - Same gesture as the current candidate → increment the hold; fire the
 *   first frame the hold REACHES `holdFrames`, then never again until it
 *   changes/drops (the count is capped at `holdFrames + 1`; the `hasFired`
 *   latch makes this robust even if `holdFrames` moves mid-hold).
 * - A different gesture → restart the hold at 1 (firing immediately if
 *   `holdFrames` is 1).
 * - `holdFrames` is floored to a minimum of 1.
 */
export function advanceGestureRecognizer(
  state: GestureRecognizerState,
  event: GestureEvent | null,
  options: Partial<GestureRecognizerOptions> = {},
): GestureRecognizerState {
  const { holdFrames, minConfidence } = { ...DEFAULT_GESTURE_RECOGNIZER_OPTIONS, ...options };
  const threshold = Number.isFinite(holdFrames) ? Math.max(1, Math.floor(holdFrames)) : 1;

  const gesture: Gesture | null = isConfidentGesture(event, minConfidence) ? event.gesture : null;
  if (gesture === null) {
    return { candidate: null, heldFrames: 0, fired: null, hasFired: false };
  }

  const sameGesture = gesture === state.candidate;
  const held = sameGesture ? Math.min(state.heldFrames + 1, threshold + 1) : 1;
  const alreadyFired = sameGesture && state.hasFired;
  const fires = !alreadyFired && held >= threshold;
  return {
    candidate: gesture,
    heldFrames: held,
    fired: fires ? gesture : null,
    hasFired: alreadyFired || fires,
  };
}
