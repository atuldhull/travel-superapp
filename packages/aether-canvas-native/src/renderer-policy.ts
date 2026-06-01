/**
 * `rendererForSurface(id)` — Phase 4 decision-#2 policy table.
 *
 * AE515. Per the Phase 4 plan (`docs/aether/15-phase4-plan.md`,
 * decision #2 locked 2026-06-01): R3F-native (via expo-three +
 * @react-three/fiber/native) for surfaces with depth, Skia-only for
 * flat surfaces. This module is the SINGLE place that policy lives;
 * every native surface mount reads through it so the choice is
 * uniform + auditable.
 *
 * Pure: no React, no Three, no Skia. Just a frozen map + a guard.
 * The actual renderer mounting lives in the per-surface scene files
 * (e.g. `scenes/pulse-glow-skia.tsx`, `scenes/drift-r3f.tsx`).
 */
import type { SurfaceId } from '@app/aether-core';

/** The two renderer paths Phase 4 ships. R3F native for true 3D
 *  (Three.js-on-Expo via expo-three); Skia for flat 2D drawing. */
export type NativeRenderer = 'r3f-native' | 'skia';

/**
 * Locked mapping from each known SurfaceId to its renderer. The flat
 * surfaces (`pulse`, `mirror`) draw with Skia for a smaller binary +
 * better battery; everything else uses R3F native for visual parity
 * with web's R3F implementation.
 *
 * `compass` is included as `r3f-native` even though only the
 * bird-mode 3D rose actually uses depth (the eye-mode AR scene is
 * deferred to Phase 5).
 */
const RENDERER_MAP: Readonly<Record<SurfaceId, NativeRenderer>> = Object.freeze({
  drift: 'r3f-native',
  atlas: 'r3f-native',
  lumen: 'r3f-native',
  genie: 'r3f-native',
  compass: 'r3f-native',
  echo: 'r3f-native',
  pulse: 'skia',
  vault: 'r3f-native',
  mirror: 'skia',
  continuum: 'skia',
});

/** Return the renderer Phase 4 mounts for the given Surface. Unknown
 *  surfaces fall back to `r3f-native` (the more capable path) so a
 *  new Surface added later still gets a viable mount until its
 *  renderer is chosen explicitly. */
export function rendererForSurface(id: SurfaceId): NativeRenderer {
  return RENDERER_MAP[id] ?? 'r3f-native';
}

/** All SurfaceIds that mount with R3F native (depth surfaces). */
export function r3fNativeSurfaceIds(): ReadonlyArray<SurfaceId> {
  return Object.entries(RENDERER_MAP)
    .filter(([, r]) => r === 'r3f-native')
    .map(([k]) => k as SurfaceId);
}

/** All SurfaceIds that mount with Skia (flat surfaces). */
export function skiaSurfaceIds(): ReadonlyArray<SurfaceId> {
  return Object.entries(RENDERER_MAP)
    .filter(([, r]) => r === 'skia')
    .map(([k]) => k as SurfaceId);
}
