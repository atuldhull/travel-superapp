/**
 * Perception layer — gaze + gesture detection.
 *
 * Phase 0 (this file) ships a STUB. Real perception lands in Phase 5
 * with mediapipe (gaze) + mediapipe-tasks-vision (gesture) once the
 * Predictor MLP is in production telemetry. Aether 0 surfaces consume
 * the stub so the API shape is locked early — no refactor when real
 * perception arrives.
 *
 * Decisions locked:
 *   • Compass Eye AR + gaze detection deferred to Phase 5 (#8).
 *   • Mood mirror emerges from telemetry (#5 implied, Phase 5).
 */
import { createContext, useContext, type ReactNode } from 'react';

/** Normalised gaze position in viewport space: x ∈ [0, 1], y ∈ [0, 1]. */
export interface GazePoint {
  readonly x: number;
  readonly y: number;
  /** Confidence ∈ [0, 1]. < 0.5 means use with skepticism. */
  readonly confidence: number;
  /** ms since epoch — for staleness checks. */
  readonly capturedAt: number;
}

/** Discrete gestures the system detects. Phase 5 expands this list. */
export type Gesture = 'open-palm' | 'pinch' | 'wave' | 'point';

export interface GestureEvent {
  readonly gesture: Gesture;
  readonly confidence: number;
  readonly capturedAt: number;
}

export interface PerceptionState {
  /** Most recent gaze point, or null if perception is off / unavailable / Phase 0. */
  readonly gaze: GazePoint | null;
  /** Most recent gesture event, or null. */
  readonly gesture: GestureEvent | null;
  /** True iff perception is actively running (camera permission + processing). */
  readonly active: boolean;
}

const PerceptionContext = createContext<PerceptionState | null>(null);

/** Phase 0 stub state — everything null/false. */
const PHASE_0_STUB: PerceptionState = {
  gaze: null,
  gesture: null,
  active: false,
};

export interface PerceptionProviderProps {
  /** Inject a real perception state (Phase 5+) or override for tests. */
  state?: PerceptionState;
  children: ReactNode;
}

export function PerceptionProvider({
  state = PHASE_0_STUB,
  children,
}: PerceptionProviderProps): React.ReactElement {
  return <PerceptionContext.Provider value={state}>{children}</PerceptionContext.Provider>;
}

/** Read the perception state. Returns the Phase 0 stub if no provider
 *  is mounted (perception is genuinely optional — no throw). */
export function usePerception(): PerceptionState {
  return useContext(PerceptionContext) ?? PHASE_0_STUB;
}
