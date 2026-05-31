/**
 * AE402 — pure helpers for the Lumen click-to-zoom photo detail state.
 *
 * Per docs/aether/02-surfaces.md §4 Lumen: "Pinch-zoom (mobile) or
 * scroll-pinch (web) to enter a single photo. The photo becomes a wall;
 * the rest of the trip's photos arrange themselves in 3D around it
 * like a museum." AE402 ships the click-to-zoom path: tap a photo, the
 * camera dollies in, the other planes dim. AE403+ adds keyboard nav
 * and AE410+ adds the pinch gesture for mobile.
 *
 * Pure: no React, no R3F. The hook + provider in
 * `lumen-selection-context.tsx` wires the state side; this module
 * shapes the camera transitions + decides which plane is focused.
 */
import type { LumenPlaneLayout } from './lumen-cloud';
import type { Vec3Tuple } from '@app/aether-canvas';

/** Lumen camera target — `(position, lookAt)` triple in world units.
 *  The R3F camera driver lerps between targets across the lifecycle. */
export interface LumenCameraTarget {
  readonly position: Vec3Tuple;
  readonly lookAt: Vec3Tuple;
}

/** Default cloud-overview camera pose. Frames the whole 18 × 8 layout
 *  comfortably with the rails visible at the bottom of the frame. */
export const LUMEN_OVERVIEW_TARGET: LumenCameraTarget = Object.freeze({
  position: [0, 0, 12] as Vec3Tuple,
  lookAt: [0, 0, 0] as Vec3Tuple,
});

/** Camera pose for a focused photo plane. Dollies in to ~2.4 units in
 *  front of the plane, lookAt centred on the plane. The `dollyZ`
 *  parameter is exposed so future slices can tune the museum feel
 *  (closer = "in your face"; farther = "respectful step back"). */
export function cameraTargetForPhoto(
  plane: LumenPlaneLayout,
  dollyZ: number = 2.4,
): LumenCameraTarget {
  const [x, y, z] = plane.position;
  return {
    position: [x, y, z + dollyZ],
    lookAt: [x, y, z],
  };
}

/** Resolve the camera target for the current focus state. Null →
 *  overview; otherwise dolly to the focused plane. Pure so the
 *  R3F driver can call it inside `useFrame` without React state. */
export function resolveLumenCameraTarget(
  focusedId: string | null,
  planes: ReadonlyArray<LumenPlaneLayout>,
  dollyZ: number = 2.4,
): LumenCameraTarget {
  if (focusedId === null) return LUMEN_OVERVIEW_TARGET;
  const plane = planes.find((p) => p.id === focusedId);
  if (plane === undefined) return LUMEN_OVERVIEW_TARGET;
  return cameraTargetForPhoto(plane, dollyZ);
}

/** Per-plane opacity multiplier when something is focused. Focused
 *  plane is 1.0 (full); unfocused are dimmed to `dimAmount`. */
export function planeOpacityForFocus(
  planeId: string,
  focusedId: string | null,
  dimAmount: number = 0.18,
): number {
  if (focusedId === null) return 1; // overview — all planes at full
  if (planeId === focusedId) return 1;
  return dimAmount;
}

/** Per-plane scale multiplier when something is focused. The focused
 *  plane bumps up slightly (1.0 → 1.06) for emphasis; unfocused are
 *  scaled down to 0.92 so the focused plane reads as the focal element
 *  without entirely hiding context. */
export function planeScaleForFocus(planeId: string, focusedId: string | null): number {
  if (focusedId === null) return 1;
  if (planeId === focusedId) return 1.06;
  return 0.92;
}
