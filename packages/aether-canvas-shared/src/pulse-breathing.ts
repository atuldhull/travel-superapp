/**
 * Pulse breathing math — pure helpers (AE455).
 *
 * Moved from `apps/web/src/components/aether/phase1/pulse-breathing.ts`
 * into the Phase 4 shared sub-package so both web (AE389) and the
 * Phase 4 native Pulse consume identical breathing envelopes. The
 * web file re-exports from here so existing imports stay valid.
 *
 * Per docs/aether/02-surfaces.md §7 Pulse the always-present AI:
 *   idle      — gentle 8-second breathing cycle
 *   listening — faster, brighter
 *   speaking  — visible audio-amplitude pulse
 *   sleeping  — dim, almost gone (low battery / user inactive)
 *
 * Phase 1 first cut doesn't have voice (Genie lands Phase 2), so the
 * mood is derived from the active route-bound Surface's lifecycle phase
 * — when the surface is mid-transition the Pulse picks up energy, when
 * the surface is in idle/listening the Pulse breathes at its rest cadence.
 *
 * Everything here is pure (no React, no R3F, no DOM, no time source) so
 * the lifecycle scene can drive it from `useFrame`'s delta clock + tests
 * can pin `tMs` and assert exact scale/opacity values.
 */
import type { SurfaceLifecyclePhase } from '@app/aether-core';

/** Pulse's own state machine. Distinct from the surface lifecycle —
 *  surface phase drives which mood Pulse takes by default but callers
 *  can pin a mood (e.g. low-battery → 'sleeping') via prop override. */
export type PulseMood = 'idle' | 'listening' | 'speaking' | 'sleeping';

/** Breathing parameters for one mood.
 *  - `periodMs` — one full sine cycle in milliseconds
 *  - `scaleMin/Max` — sphere scale envelope (1.0 = baseline radius)
 *  - `opacityMin/Max` — material opacity envelope (0..1) */
export interface PulseBreathParams {
  readonly periodMs: number;
  readonly scaleMin: number;
  readonly scaleMax: number;
  readonly opacityMin: number;
  readonly opacityMax: number;
}

/** Resolved breath output at a moment in time. */
export interface PulseBreathState {
  readonly scale: number;
  readonly opacity: number;
}

/** Per-mood envelope. Numbers chosen to feel calibrated:
 *   • idle 8s matches the docs' "gentle 8-second breathing cycle"
 *   • listening 1.8s feels alert without seizure-territory
 *   • speaking 0.6s is the visible audio-amplitude pulse
 *   • sleeping 14s is "almost gone" — bigger period, lower opacity,
 *     smaller scale (so it shrinks too, not just dims) */
const PULSE_BREATH_TABLE: Record<PulseMood, PulseBreathParams> = {
  idle: {
    periodMs: 8000,
    scaleMin: 0.92,
    scaleMax: 1.0,
    opacityMin: 0.45,
    opacityMax: 0.7,
  },
  listening: {
    periodMs: 1800,
    scaleMin: 1.0,
    scaleMax: 1.15,
    opacityMin: 0.7,
    opacityMax: 0.95,
  },
  speaking: {
    periodMs: 600,
    scaleMin: 0.95,
    scaleMax: 1.1,
    opacityMin: 0.7,
    opacityMax: 1.0,
  },
  sleeping: {
    periodMs: 14000,
    scaleMin: 0.85,
    scaleMax: 0.92,
    opacityMin: 0.15,
    opacityMax: 0.3,
  },
};

/** Read the breath envelope for a mood. Returns the same frozen object
 *  every call — callers that mutate it should clone first. */
export function pulseBreathParams(mood: PulseMood): PulseBreathParams {
  return PULSE_BREATH_TABLE[mood];
}

/** Map the active route-bound Surface's lifecycle phase to a Pulse
 *  mood. The mapping prefers "alive but calm" — Pulse stays at its
 *  rest cadence ('idle') most of the time and only flares up during
 *  the brief materialise / dissolve windows.
 *
 *  Phase 1 mapping (subject to refinement as Genie + persona land):
 *    'idle'         → 'sleeping'   (no active scene; battery-save vibe)
 *    'materialising'→ 'speaking'   (scene assembling — show energy)
 *    'settling'     → 'listening'  (scene just landed — pulse leans in)
 *    'listening'    → 'idle'       (surface in steady-state listening loop)
 *    'dissolving'   → 'speaking'   (scene tearing down — energy again) */
export function moodFromPhase(phase: SurfaceLifecyclePhase): PulseMood {
  switch (phase) {
    case 'idle':
      return 'sleeping';
    case 'materialising':
      return 'speaking';
    case 'settling':
      return 'listening';
    case 'listening':
      return 'idle';
    case 'dissolving':
      return 'speaking';
  }
}

/** Compute the breath state at a moment in the mood's cycle.
 *
 *  `tMs` is the elapsed time (in milliseconds) since the breath started
 *  — typically `performance.now() - startTime`, or in tests, a fixed
 *  number. We sample `sin(2π · (t mod period) / period)` and remap from
 *  [-1, 1] to the mood's [min, max] envelope.
 *
 *  Negative or NaN `tMs` clamps to 0 (mid-cycle null is worse than
 *  the start position). Infinite values resolve to the cycle's
 *  baseline (lerp midpoint) so the renderer doesn't blow up. */
export function pulseBreathAt(mood: PulseMood, tMs: number): PulseBreathState {
  const p = PULSE_BREATH_TABLE[mood];
  if (!Number.isFinite(tMs)) {
    const mid = 0.5;
    return {
      scale: p.scaleMin + (p.scaleMax - p.scaleMin) * mid,
      opacity: p.opacityMin + (p.opacityMax - p.opacityMin) * mid,
    };
  }
  const t = tMs < 0 ? 0 : tMs;
  const cyclePos = (t % p.periodMs) / p.periodMs; // 0..1
  // Map sin(2π · cyclePos) ∈ [-1, 1] to [0, 1].
  const w = (Math.sin(2 * Math.PI * cyclePos) + 1) / 2;
  return {
    scale: p.scaleMin + (p.scaleMax - p.scaleMin) * w,
    opacity: p.opacityMin + (p.opacityMax - p.opacityMin) * w,
  };
}

/** Reduced-motion override — the breath collapses to a static glow at
 *  the cycle midpoint. Caller still picks the mood (so colour stays
 *  meaningful) but the scale + opacity stop oscillating. */
export function pulseBreathStatic(mood: PulseMood): PulseBreathState {
  const p = PULSE_BREATH_TABLE[mood];
  const mid = 0.5;
  return {
    scale: p.scaleMin + (p.scaleMax - p.scaleMin) * mid,
    opacity: p.opacityMin + (p.opacityMax - p.opacityMin) * mid,
  };
}
