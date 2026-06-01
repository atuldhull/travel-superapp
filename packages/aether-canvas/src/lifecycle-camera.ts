/**
 * Lifecycle-driven camera math — re-export from `@app/aether-canvas-shared`.
 *
 * The actual implementation moved to the shared package in AE454 so the
 * Phase 4 native canvas can consume identical pose interpolation
 * without pulling R3F peer dependencies. This file remains for back-
 * compat with web callsites that import from `@app/aether-canvas`.
 */
export {
  DEFAULT_CAMERA_SCRIPT,
  cameraPoseAt,
  lerp,
  lerpVec3,
  previousPoseFor,
  type CameraPose,
  type CameraScript,
  type Vec3Tuple,
} from '@app/aether-canvas-shared';
