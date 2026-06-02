/**
 * `mock-perception` — a deterministic perception source for dev + tests
 * (Phase 5, AE595).
 *
 * Real perception needs a camera + mediapipe (gated, off-device). Until
 * then, consumers build against this: a pure function of time `t` (ms)
 * that produces a `PerceptionState` — gaze drifting on a Lissajous path,
 * a gesture cycling on a fixed schedule. Deterministic (no clock read, no
 * RNG), so a test asserts exact frames and a dev wires
 * `<PerceptionProvider state={mockPerceptionStateAt(t)}>` with a ticker to
 * see perception-driven UI before the model exists.
 */
import {
  PERCEPTION_GESTURES,
  type GazePoint,
  type Gesture,
  type GestureEvent,
  type PerceptionState,
} from './perception-frame';

/** Full Lissajous sweep period for the mock gaze (ms). */
export const MOCK_GAZE_PERIOD_MS = 8000;

/** Gesture schedule: one gesture fires for the first slice of each window,
 *  then nothing for the rest. */
export const MOCK_GESTURE_WINDOW_MS = 3000;
export const MOCK_GESTURE_ACTIVE_MS = 600;

/** Non-negative time within the period, safe against non-finite input. */
function safeTime(t: number): number {
  return Number.isFinite(t) && t > 0 ? t : 0;
}

/**
 * Deterministic gaze at time `t`: x/y trace a Lissajous figure within
 * [0.1, 0.9] inclusive — the endpoints ARE reached (x = 0.9 at
 * t = PERIOD/4, y = 0.9 at t = 0) — at steady high confidence.
 */
export function mockGazeAt(t: number): GazePoint {
  const tt = safeTime(t);
  const phase = (tt / MOCK_GAZE_PERIOD_MS) * 2 * Math.PI;
  const x = 0.5 + 0.4 * Math.sin(phase);
  const y = 0.5 + 0.4 * Math.cos(phase * 2); // 2:1 ratio = a figure-eight
  return { x, y, confidence: 0.9, capturedAt: tt };
}

/** Which gesture a given window emits — cycles through PERCEPTION_GESTURES. */
function gestureForWindow(windowIndex: number): Gesture {
  const i =
    ((windowIndex % PERCEPTION_GESTURES.length) + PERCEPTION_GESTURES.length) %
    PERCEPTION_GESTURES.length;
  return PERCEPTION_GESTURES[i] ?? 'point';
}

/**
 * Deterministic gesture at time `t`: each `MOCK_GESTURE_WINDOW_MS` window
 * fires one gesture for its first `MOCK_GESTURE_ACTIVE_MS`, then null. The
 * gesture cycles open-palm → pinch → wave → point → … across windows.
 */
export function mockGestureAt(t: number): GestureEvent | null {
  const tt = safeTime(t);
  const within = tt % MOCK_GESTURE_WINDOW_MS;
  if (within >= MOCK_GESTURE_ACTIVE_MS) return null;
  const windowIndex = Math.floor(tt / MOCK_GESTURE_WINDOW_MS);
  return { gesture: gestureForWindow(windowIndex), confidence: 0.85, capturedAt: tt };
}

/** Deterministic full perception frame at time `t` (always `active`). */
export function mockPerceptionStateAt(t: number): PerceptionState {
  return {
    gaze: mockGazeAt(t),
    gesture: mockGestureAt(t),
    active: true,
  };
}
