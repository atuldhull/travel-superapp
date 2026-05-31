'use client';

/**
 * Phase 1 Drift surface — the first 3D scene wired through the AE374
 * Surface manager + AE375 SurfaceCanvas.
 *
 * Composition (matches the Phase 0 hero feel but in R3F now):
 *   • <DepthFog>        — cream depth haze (so the field doesn't pop)
 *   • <SunDisk>         — terracotta/ochre gradient disk, slow rotation
 *   • <AmbientField>    — 600 dust motes, deterministic noise
 *   • <ParticleBurst>   — inward during materialising, outward during
 *                         dissolving, idle (at bounds) the rest of the time
 *
 * The component is the **default export** so AE374's `SurfaceMountLoader`
 * pattern (`() => import('./drift-phase1-scene')`) hands it directly to
 * React.lazy. The `SurfaceMountFrame` (or our SurfaceCanvas wrapper)
 * passes `surface` + `phase` props per `SurfaceMountProps`.
 */
import { useMemo } from 'react';
import {
  AmbientField,
  DepthFog,
  ParticleBurst,
  SunDisk,
  easedPhaseProgress,
  type BurstMode,
} from '@app/aether-canvas';
import { useSurfacePaletteSlots, type SurfaceMountProps } from '@app/aether-core';

/** AE375 default phase durations — we mirror them here so the burst
 *  progress lines up with the camera fade. */
const PHASE_DURATIONS = {
  materialising: 0.7,
  settling: 0.5,
  dissolving: 0.5,
} as const;

export default function DriftPhase1Scene({ phase }: SurfaceMountProps): React.ReactElement {
  // AE381 — Drift's per-surface palette feeds the burst + ambient field
  // accents. The Drift registry palette = sunset (ochre glow + warm
  // terracotta accent + olive support).
  const palette = useSurfacePaletteSlots();

  // The burst mode is the surface's lifecycle phase mapped onto a 3-state
  // particle direction. Idle / settling / listening → at-rest at bounds.
  const burstMode = useMemo<BurstMode>(() => {
    if (phase === 'materialising') return 'inward';
    if (phase === 'dissolving') return 'outward';
    return 'idle';
  }, [phase]);

  // For AE377 we pin progress to phase boundaries (0 at idle, 1 at
  // listening) so the burst snaps to its endpoint. AE375's
  // <LifecycleCameraDriver> already drives the camera per-frame; a
  // future slice can subscribe ParticleBurst progress to the same
  // elapsed-in-phase clock for a smoother fade. For now, the burst
  // animates in a single step which matches the editorial feel of the
  // hero — punchy, not lingering.
  const burstProgress = useMemo<number>(() => {
    if (phase === 'materialising') {
      return easedPhaseProgress('materialising', PHASE_DURATIONS.materialising);
    }
    if (phase === 'dissolving') {
      return easedPhaseProgress('dissolving', PHASE_DURATIONS.dissolving);
    }
    return 1;
  }, [phase]);

  return (
    <>
      {/* DepthFog colour falls back to theme cream; we don't override
          here so the fog stays neutral while the foreground accents
          carry the surface identity. */}
      <DepthFog near={6} far={22} />
      <SunDisk position={[0, 0.4, 0]} radius={1.8} />
      {/* AmbientField particles take the surface's `glow` slot — for
          Drift this is the locked ochre. */}
      <AmbientField count={600} bounds={[12, 8, 10]} color={palette.glow} />
      {/* The burst's primary colour is the surface accent. */}
      <ParticleBurst
        count={180}
        radius={7}
        mode={burstMode}
        progress={burstProgress}
        color={palette.accent}
      />
    </>
  );
}
