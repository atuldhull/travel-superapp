'use client';

/**
 * Pulse Phase 1 scene — the always-present AI's R3F representation.
 *
 * Per docs/aether/02-surfaces.md §7, Pulse is "a 60-pixel soft glow in
 * the corner of every surface". This scene draws the inside of that
 * corner glow: a small sphere (radius 1 in its private camera frame)
 * with additive blending, scaled + faded each frame by the breathing
 * math in `./pulse-breathing.ts`.
 *
 * The scene reads the active route-bound Surface's lifecycle phase via
 * `useSurfaceLifecycle()` so the Pulse picks up the moment — surface
 * materialising → Pulse 'speaking', surface listening → Pulse 'idle'
 * (calm rest cadence). Callers can pin a mood via the `mood` prop for
 * Storybook fixtures or low-battery overrides; that prop is supplied
 * by `<Phase1PulseOverlay>` which owns the host `<Canvas>`.
 *
 * Why this is a separate file from the overlay shell:
 *   • the overlay (next file) is a 64x64 fixed-corner `<div>` + a small
 *     `<Canvas>`. Tests can render the overlay in jsdom without lighting
 *     up R3F.
 *   • this file is the R3F-only inside-of-canvas scene; consumers that
 *     want to mount it via the surface registry's `mount` loader (or
 *     inside another canvas) can do so directly.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, type Mesh, type MeshBasicMaterial } from 'three';
import { useMotionPolicy } from '@app/aether-core';
import { useSurfacePaletteSlots, useSurfaceLifecycle } from '@app/aether-core';
import { moodFromPhase, pulseBreathAt, pulseBreathStatic, type PulseMood } from './pulse-breathing';

export interface PulsePhase1SceneProps {
  /** Override the auto-derived mood. Storybook + low-battery callers
   *  pass this; the default Phase 1 path derives mood from the active
   *  route-bound Surface's lifecycle phase. */
  readonly mood?: PulseMood;
}

/** Sphere radius in scene units. The overlay's small camera frames the
 *  sphere at ~80% viewport so it pops as a glow without filling the box. */
const PULSE_BASE_RADIUS = 1.0;

export default function PulsePhase1Scene({
  mood: moodOverride,
}: PulsePhase1SceneProps = {}): React.ReactElement {
  const phase = useSurfaceLifecycle();
  const palette = useSurfacePaletteSlots();
  // AE376 motion policy — 'essential' or 'none' freezes the breath at
  // its midpoint so the glow stays present (informational) but stops
  // animating.
  const motion = useMotionPolicy();
  const reducedMotion = motion !== 'full';

  // Resolve the active mood. We re-derive it on every render so the
  // mood swap is instant when the surface phase changes; the breath
  // envelope only takes effect on the next `useFrame` tick.
  const mood = useMemo<PulseMood>(
    () => moodOverride ?? moodFromPhase(phase),
    [moodOverride, phase],
  );

  // Stash the mood in a ref so the per-frame callback sees the latest
  // value without React state churn inside useFrame.
  const moodRef = useRef<PulseMood>(mood);
  useEffect(() => {
    moodRef.current = mood;
  }, [mood]);

  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<MeshBasicMaterial>(null);
  // Elapsed time in ms since this component mounted. We accumulate
  // delta from useFrame (capped at 100ms to survive tab refocus) so the
  // cycle is deterministic regardless of how often the renderer ticks.
  const elapsedRef = useRef<number>(0);

  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.1) * 1000;
    elapsedRef.current += dt;
    const breath = reducedMotion
      ? pulseBreathStatic(moodRef.current)
      : pulseBreathAt(moodRef.current, elapsedRef.current);
    if (meshRef.current !== null) {
      meshRef.current.scale.set(breath.scale, breath.scale, breath.scale);
    }
    if (materialRef.current !== null) {
      materialRef.current.opacity = breath.opacity;
    }
  });

  // Glow colour uses the surface's `glow` slot — for Drift that's the
  // locked ochre. Atlas/Compass override per their registered palette,
  // and AE384's destination override flows through too (so the Pulse
  // tints with the open trip's destination).
  return (
    <>
      {/* Soft ambient so the basic material has a baseline; the glow
          effect comes from additive blending, not from lighting. */}
      <ambientLight intensity={0.6} />
      <mesh ref={meshRef}>
        <sphereGeometry args={[PULSE_BASE_RADIUS, 32, 32]} />
        <meshBasicMaterial
          ref={materialRef}
          color={palette.glow}
          transparent
          opacity={0.7}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Outer halo — a slightly larger sphere with a paler accent for
          the "soft glow" feel. Static (no breath driver) so the inner
          sphere reads as the breathing layer. */}
      <mesh scale={[1.4, 1.4, 1.4]}>
        <sphereGeometry args={[PULSE_BASE_RADIUS, 24, 24]} />
        <meshBasicMaterial
          color={palette.accent}
          transparent
          opacity={0.18}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}
