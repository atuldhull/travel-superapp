'use client';

/**
 * `useLifecycleAutoDriver` — automatically steps the active Surface
 * through its lifecycle FSM on mount.
 *
 * The Surface manager (AE374) provides `setPhase` but stays passive
 * about WHEN to advance — the canvas package's `<LifecycleCameraDriver>`
 * (AE375) drives the per-frame camera based on the phase the manager
 * is in, but doesn't itself advance the FSM. AE377 wires the **timing**:
 * on mount, schedule the natural progression
 *
 *   idle → materialising → settling → listening
 *
 * over the configured durations (defaults to the AE375 / AE376 stack:
 * 0.7s + 0.5s + 0.5s).
 *
 * AE382 closes the loop. When `LifecyclePlan.listeningHoldMs` is set
 * (the `BREATHING_LIFECYCLE_PLAN` preset does this) the FSM continues:
 *
 *   listening → dissolving → idle → materialising → … (cycle)
 *
 * The dissolve duration is `dissolvingMs`. The Next.js 15 App Router
 * removed the `router.events` API the original plan called for, so
 * navigation-triggered dissolves (router events → setPhase) aren't
 * available; the listening-hold loop is the closest equivalent that
 * still exercises every phase, and it lets demos + dev users see the
 * full 5-phase animation without navigating.
 */
import { useEffect } from 'react';
import { useSurfaceManager, type SurfaceLifecyclePhase } from '@app/aether-core';

export interface LifecyclePlan {
  /** Wait ms before idle → materialising. */
  readonly idleHoldMs: number;
  /** Materialising → settling. */
  readonly materialisingMs: number;
  /** Settling → listening. */
  readonly settlingMs: number;
  /** Dissolving → idle. */
  readonly dissolvingMs: number;
  /** When set, listening will dissolve after this many ms (closes the
   *  loop). When omitted, listening is the terminal phase (the AE377
   *  default behaviour — useful for surfaces that don't loop). */
  readonly listeningHoldMs?: number;
}

/** The original AE377 plan — no loop. The lifecycle stops at listening
 *  and stays there until external code calls `setPhase('dissolving')`. */
export const DEFAULT_LIFECYCLE_PLAN: LifecyclePlan = {
  idleHoldMs: 60,
  materialisingMs: 700,
  settlingMs: 500,
  dissolvingMs: 500,
};

/** AE382 — looping preset. Listening holds for 8s, then dissolves and
 *  re-materialises. Used by the Phase 1 shells so the dissolve audio
 *  fade-down + camera pull-back actually play out, and so demos see the
 *  full lifecycle cycling without navigation. */
export const BREATHING_LIFECYCLE_PLAN: LifecyclePlan = {
  ...DEFAULT_LIFECYCLE_PLAN,
  listeningHoldMs: 8000,
};

/** Pure: which phase the FSM should advance to next, ignoring time. The
 *  plan controls whether listening is terminal (returns null) or loops
 *  through dissolving → idle. */
export function nextPhaseInChain(
  phase: SurfaceLifecyclePhase,
  plan: LifecyclePlan = DEFAULT_LIFECYCLE_PLAN,
): SurfaceLifecyclePhase | null {
  switch (phase) {
    case 'idle':
      return 'materialising';
    case 'materialising':
      return 'settling';
    case 'settling':
      return 'listening';
    case 'listening':
      return plan.listeningHoldMs !== undefined ? 'dissolving' : null;
    case 'dissolving':
      // Dissolving auto-advances back to idle only when the plan has
      // listeningHoldMs (i.e. we're in a looping plan). External code
      // calling setPhase('dissolving') outside a looping plan should
      // own the transition back to idle itself.
      return plan.listeningHoldMs !== undefined ? 'idle' : null;
  }
}

/** Pure: the delay (in ms) the hook should wait before advancing OUT of
 *  this phase. Listening returns `listeningHoldMs ?? 0` so the hook
 *  short-circuits on the null return from `nextPhaseInChain` when the
 *  plan has no listening hold. */
export function phaseDelayFor(phase: SurfaceLifecyclePhase, plan: LifecyclePlan): number {
  switch (phase) {
    case 'idle':
      return plan.idleHoldMs;
    case 'materialising':
      return plan.materialisingMs;
    case 'settling':
      return plan.settlingMs;
    case 'listening':
      return plan.listeningHoldMs ?? 0;
    case 'dissolving':
      return plan.dissolvingMs;
  }
}

/** Pure: given a current phase and the elapsed-since-this-phase-entered,
 *  return the phase the FSM should now be in (or `null` if no transition
 *  is due yet). Composition of the two helpers above, kept for tests + as
 *  the natural query for non-React consumers (e.g. tracking a phase
 *  fence inside a useFrame loop without the React-level timer). */
export function nextScheduledPhase(
  phase: SurfaceLifecyclePhase,
  elapsedMs: number,
  plan: LifecyclePlan,
): SurfaceLifecyclePhase | null {
  const next = nextPhaseInChain(phase, plan);
  if (next === null) return null;
  return elapsedMs >= phaseDelayFor(phase, plan) ? next : null;
}

/** React hook that wires the FSM to `window.setTimeout` on the Surface
 *  manager. On every phase change, schedules the next forward step (if
 *  any) and clears the timer on unmount.
 *
 *  Returns nothing — pure side-effect. */
export function useLifecycleAutoDriver(plan: LifecyclePlan = DEFAULT_LIFECYCLE_PLAN): void {
  const { current, phase, setPhase } = useSurfaceManager();

  useEffect(() => {
    if (current === null) return undefined;
    const next = nextPhaseInChain(phase, plan);
    if (next === null) return undefined;
    const delay = phaseDelayFor(phase, plan);
    const handle = window.setTimeout(() => {
      setPhase(next);
    }, delay);
    return () => {
      window.clearTimeout(handle);
    };
  }, [current, phase, plan, setPhase]);
}
