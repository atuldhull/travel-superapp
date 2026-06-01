/**
 * Lifecycle phase progress — pure helpers (AE454).
 *
 * Moved from `@app/aether-canvas/src/lifecycle-progress.ts` into the
 * Phase 4 shared sub-package so both web R3F and native R3F consume
 * identical phase-progress math. The web package re-exports from here
 * so existing imports stay valid.
 *
 * The Aether Surface lifecycle (`@app/aether-core/surface`) is a five-state
 * FSM: idle → materialising → settling → listening → dissolving → idle.
 * The canvas package needs a way to read "how far through the current phase
 * are we?" so cameras, fog, and particle bursts can interpolate smoothly.
 *
 * This file is pure (no React, no Three, no DOM). The `SurfaceCanvas` adapter
 * feeds `useFrame` deltas into these functions and renders the result.
 *
 * Default durations (in seconds) chosen so the full materialise→settle
 * pass feels roughly 1.2s of motion before the user starts interacting.
 * Caller can override per surface via `LifecyclePhaseDurations`.
 */
import type { SurfaceLifecyclePhase } from '@app/aether-core';

/** Per-phase duration in seconds. `idle` + `listening` are ambient phases
 *  (no clamped end) — their durations are interpreted as "elapsed time
 *  before progress wraps back to 0", useful for breathing animations.
 *  Defaults to 1.0 for ambient phases. */
export interface LifecyclePhaseDurations {
  readonly materialising: number;
  readonly settling: number;
  readonly dissolving: number;
  /** Optional ambient loop seconds — defaults to 1 if omitted. */
  readonly idle?: number;
  readonly listening?: number;
}

export const DEFAULT_PHASE_DURATIONS: LifecyclePhaseDurations = {
  materialising: 0.7,
  settling: 0.5,
  dissolving: 0.5,
  idle: 1.0,
  listening: 1.0,
};

/** Clamp t to [0, 1]. */
function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Cubic ease-out — accelerates, then settles. Matches the spring feel of
 *  the Phase 0 `@app/aether-motion/spring` defaults without needing a real
 *  spring evaluator on the hot path. */
export function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

/** Cubic ease-in — for dissolving. */
export function easeInCubic(t: number): number {
  const x = clamp01(t);
  return x * x * x;
}

/** Phase progress 0..1 given elapsed seconds-in-phase + durations. For
 *  transient phases (materialising / settling / dissolving) progress clamps
 *  to 1.0. For ambient phases (idle / listening) progress wraps modulo the
 *  configured ambient duration so callers can drive breathing loops. */
export function phaseProgress(
  phase: SurfaceLifecyclePhase,
  elapsedInPhase: number,
  durations: LifecyclePhaseDurations = DEFAULT_PHASE_DURATIONS,
): number {
  const e = elapsedInPhase < 0 ? 0 : elapsedInPhase;
  switch (phase) {
    case 'materialising':
      return clamp01(e / durations.materialising);
    case 'settling':
      return clamp01(e / durations.settling);
    case 'dissolving':
      return clamp01(e / durations.dissolving);
    case 'idle':
      return wrap01(e, durations.idle ?? 1.0);
    case 'listening':
      return wrap01(e, durations.listening ?? 1.0);
  }
}

/** Eased progress — `materialising` + `settling` ease-out, `dissolving`
 *  eases in (so the disappear accelerates), ambient phases are linear. */
export function easedPhaseProgress(
  phase: SurfaceLifecyclePhase,
  elapsedInPhase: number,
  durations: LifecyclePhaseDurations = DEFAULT_PHASE_DURATIONS,
): number {
  const p = phaseProgress(phase, elapsedInPhase, durations);
  switch (phase) {
    case 'materialising':
    case 'settling':
      return easeOutCubic(p);
    case 'dissolving':
      return easeInCubic(p);
    case 'idle':
    case 'listening':
      return p;
  }
}

/** True iff the phase has reached its terminal frame (transient phases only).
 *  Ambient phases are never "complete". */
export function isPhaseComplete(
  phase: SurfaceLifecyclePhase,
  elapsedInPhase: number,
  durations: LifecyclePhaseDurations = DEFAULT_PHASE_DURATIONS,
): boolean {
  switch (phase) {
    case 'materialising':
      return elapsedInPhase >= durations.materialising;
    case 'settling':
      return elapsedInPhase >= durations.settling;
    case 'dissolving':
      return elapsedInPhase >= durations.dissolving;
    case 'idle':
    case 'listening':
      return false;
  }
}

/** Modulo-wrap for ambient phases: `wrap01(1.6, 1) === 0.6`. */
function wrap01(elapsed: number, period: number): number {
  if (period <= 0) return 0;
  const r = elapsed % period;
  return r / period;
}

/** Test-only exports for the pure internals. */
export const __testing = { clamp01, wrap01 };
