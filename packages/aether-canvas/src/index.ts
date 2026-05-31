/**
 * @app/aether-canvas — R3F + WebGPU primitives for Aether surfaces.
 *
 * Phase 0 primitives (still shipped, no changes):
 *   • <AetherScene>   — Canvas wrapper with Warm Italian lighting rig
 *   • <AmbientField>  — deterministic particle field ("dust catching light")
 *   • <SunDisk>       — gradient-shaded hero disk
 *
 * Phase 1 additions (AE375):
 *   • <SurfaceCanvas>      — bridge between AE374's Surface manager and R3F
 *   • <LifecycleCameraDriver> — useFrame driver that interpolates the camera
 *                               through the lifecycle phases
 *   • <DepthFog>           — per-surface linear fog primitive
 *   • <ParticleBurst>      — one-shot directional particle scatter for
 *                            materialise / dissolve transitions
 *   • Pure helpers — `cameraPoseAt`, `phaseProgress`, `easedPhaseProgress`,
 *                    `isPhaseComplete`, `lerpVec3`, `linearFogDensity`,
 *                    `burstOffset`, scripts + duration defaults
 *
 * Phase 2 adds: <AtlasGlobe>, <RouteRibbon>, <BuildingShell>.
 */
export { AetherScene, type AetherSceneProps } from './aether-scene';
export { AmbientField, type AmbientFieldProps } from './ambient-field';
export { SunDisk, type SunDiskProps } from './sun-disk';
export { detectRenderer, defaultRenderer, type RendererCapability } from './renderer-capability';

// Phase 1 (AE375) — Surface bridge + lifecycle camera + transition primitives.
export { SurfaceCanvas, LifecycleCameraDriver, type SurfaceCanvasProps } from './surface-canvas';
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
export {
  DEFAULT_PHASE_DURATIONS,
  easeInCubic,
  easeOutCubic,
  easedPhaseProgress,
  isPhaseComplete,
  phaseProgress,
  type LifecyclePhaseDurations,
} from './lifecycle-progress';
export { DepthFog, linearFogDensity, type DepthFogProps } from './depth-fog';
export {
  ParticleBurst,
  burstOffset,
  type BurstMode,
  type ParticleBurstProps,
} from './particle-burst';
export { WeatherStreaks, streakYAt, type WeatherStreaksProps } from './weather-streaks';
// AE401 — textured photo plane primitive used by Lumen (Phase 2).
export { PhotoPlane, type PhotoPlaneProps } from './photo-plane';
