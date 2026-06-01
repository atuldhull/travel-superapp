/**
 * @app/aether-canvas-shared — pure helpers consumed by both the web
 * canvas package (`@app/aether-canvas`) and the Phase 4 native canvas
 * package (`@app/aether-canvas/native`).
 *
 * Everything exported here MUST be framework-free: no React, no DOM,
 * no Three.js, no R3F. Only depends on type-only imports from
 * `@app/aether-core` (e.g. `SurfaceLifecyclePhase`).
 */

export const AETHER_CANVAS_SHARED_VERSION = '0.0.1';

// AE454 — lifecycle progress + camera-pose math.
export {
  DEFAULT_PHASE_DURATIONS,
  easeInCubic,
  easeOutCubic,
  easedPhaseProgress,
  isPhaseComplete,
  phaseProgress,
  __testing,
  type LifecyclePhaseDurations,
} from './lifecycle-progress';

export {
  DEFAULT_CAMERA_SCRIPT,
  cameraPoseAt,
  lerp,
  lerpVec3,
  previousPoseFor,
  type CameraPose,
  type CameraScript,
  type Vec3Tuple,
} from './lifecycle-camera';

// AE455 — Pulse breathing envelopes.
export {
  moodFromPhase,
  pulseBreathAt,
  pulseBreathParams,
  pulseBreathStatic,
  type PulseBreathParams,
  type PulseBreathState,
  type PulseMood,
} from './pulse-breathing';
