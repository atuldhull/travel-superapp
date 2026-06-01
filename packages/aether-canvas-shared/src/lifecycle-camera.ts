/**
 * Lifecycle-driven camera math (AE454).
 *
 * Moved from `@app/aether-canvas/src/lifecycle-camera.ts` into the Phase 4
 * shared sub-package so both web R3F and native R3F consume identical
 * camera-pose interpolation. The web package re-exports from here so
 * existing imports stay valid.
 *
 * Each phase of the Surface lifecycle has a target camera pose. The frame
 * loop interpolates from the previous pose to the next using the eased
 * `phaseProgress`, so the camera glides through materialise → settle →
 * listen → dissolve without scripting in any particular consumer.
 *
 * Pure — no Three, no React, no DOM. The `SurfaceCanvas` adapter calls these
 * from `useFrame` and applies the result to the camera reference. That keeps
 * the core math testable without spinning up an R3F context in jest+jsdom.
 *
 * Coordinate convention (Three's default):
 *   +X right, +Y up, +Z toward the viewer.
 * Drift's hero pose is (0, 0, 6) looking at the origin — chosen to match
 * the existing `<AetherScene>` default `cameraPosition`.
 */
import type { SurfaceLifecyclePhase } from '@app/aether-core';
import { easedPhaseProgress, type LifecyclePhaseDurations } from './lifecycle-progress';

/** XYZ tuple — caller-friendly, copy-on-read. */
export type Vec3Tuple = readonly [number, number, number];

/** Per-phase target camera pose. */
export interface CameraPose {
  readonly position: Vec3Tuple;
  readonly lookAt: Vec3Tuple;
}

/** The five poses (one per lifecycle phase). Tuned so:
 *   - idle:          rest pose (hero distance)
 *   - materialising: starts farther + slightly above, pulls in
 *   - settling:      lands at hero distance
 *   - listening:     hero + slight z drift (parallax)
 *   - dissolving:    pulls back out + slightly above on the way out
 */
export interface CameraScript {
  readonly idle: CameraPose;
  readonly materialising: CameraPose;
  readonly settling: CameraPose;
  readonly listening: CameraPose;
  readonly dissolving: CameraPose;
}

/** Aether's default Drift script — matches `<AetherScene>` defaults. */
export const DEFAULT_CAMERA_SCRIPT: CameraScript = {
  idle: { position: [0, 0, 6], lookAt: [0, 0, 0] },
  materialising: { position: [0, 1.5, 9], lookAt: [0, 0, 0] },
  settling: { position: [0, 0, 6], lookAt: [0, 0, 0] },
  listening: { position: [0, 0, 6], lookAt: [0, 0, 0] },
  dissolving: { position: [0, 1.5, 10], lookAt: [0, 0, 0] },
};

/** Linear interpolation between two scalars. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Linear interpolation between two Vec3 tuples. */
export function lerpVec3(a: Vec3Tuple, b: Vec3Tuple, t: number): Vec3Tuple {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** Returns the previous phase's pose (the one we interpolate FROM during a
 *  transient phase). For ambient phases we stay at the script entry. */
export function previousPoseFor(phase: SurfaceLifecyclePhase, script: CameraScript): CameraPose {
  switch (phase) {
    case 'materialising':
      return script.idle;
    case 'settling':
      return script.materialising;
    case 'listening':
      return script.settling;
    case 'dissolving':
      return script.listening;
    case 'idle':
      return script.idle;
  }
}

/** Compute the eased pose for the current phase + elapsed-in-phase. */
export function cameraPoseAt(
  phase: SurfaceLifecyclePhase,
  elapsedInPhase: number,
  script: CameraScript = DEFAULT_CAMERA_SCRIPT,
  durations?: LifecyclePhaseDurations,
): CameraPose {
  const t = easedPhaseProgress(phase, elapsedInPhase, durations);
  const from = previousPoseFor(phase, script);
  const to = script[phase];
  return {
    position: lerpVec3(from.position, to.position, t),
    lookAt: lerpVec3(from.lookAt, to.lookAt, t),
  };
}
