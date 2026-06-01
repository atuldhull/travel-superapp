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

// AE456 — spatial layout math (Atlas / Compass / Lumen / Vault / Echo).
export {
  DEFAULT_ATLAS_LAYOUT,
  dayPositionOnAxis,
  layoutDayMarkers,
  layoutOrbsForTrip,
  orbColorForItem,
  orbSizeForItem,
  orbZForSlot,
  type AtlasDayLike,
  type AtlasItemLike,
  type AtlasLayoutConfig,
  type DayMarkerLayout,
  type OrbLayout,
} from './atlas-orbs';

export {
  CARDINALS,
  angularDistance,
  bearingPositionOnRing,
  bearingToVec3,
  cardinalAt,
  normalizeBearing,
  type CompassPosition,
} from './compass-rose';

export {
  DEFAULT_LUMEN_LAYOUT,
  clampRating,
  jitterZFor,
  layoutPhotoCloud,
  ratingToY,
  sortPhotosByTime,
  timeToX,
  type LumenLayoutConfig,
  type LumenPhotoLike,
  type LumenPlaneLayout,
} from './lumen-cloud';

export {
  DEFAULT_VAULT_BASE_SCALE,
  DEFAULT_VAULT_FLOAT_AMPLITUDE,
  DEFAULT_VAULT_FLOAT_FREQUENCY,
  DEFAULT_VAULT_PHASE_OFFSET,
  DEFAULT_VAULT_RING_RADIUS,
  glyphFloatY,
  glyphHaloIntensity,
  glyphRingPosition,
  glyphSphereScale,
} from './vault-glyph-positions';

export {
  ECHO_CARD_HEIGHT,
  ECHO_CARD_SPACING_Y,
  ECHO_CARD_WIDTH,
  echoCardOpacity,
  echoCardScale,
  echoCardVisible,
  echoCardY,
  visibleEchoSlots,
} from './echo-layout';
