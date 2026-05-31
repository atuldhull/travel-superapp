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
 * 0.7s + 0.5s + 0.5s). Dissolving is not auto-triggered — it's owned by
 * the navigation event (a future slice will wire `router.events` to
 * call `setPhase('dissolving')` before the next route mounts).
 */
import { useEffect } from 'react';
import { useSurfaceManager, type SurfaceLifecyclePhase } from '@app/aether-core';

export interface LifecyclePlan {
  /** Seconds to wait before transitioning idle → materialising. */
  readonly idleHoldMs: number;
  /** Materialising → settling. */
  readonly materialisingMs: number;
  /** Settling → listening. */
  readonly settlingMs: number;
}

export const DEFAULT_LIFECYCLE_PLAN: LifecyclePlan = {
  idleHoldMs: 60,
  materialisingMs: 700,
  settlingMs: 500,
};

/** Pure: which phase the FSM should advance to next, ignoring time. Used
 *  by the hook to look up the destination phase, and exposed for tests. */
export function nextPhaseInChain(phase: SurfaceLifecyclePhase): SurfaceLifecyclePhase | null {
  switch (phase) {
    case 'idle':
      return 'materialising';
    case 'materialising':
      return 'settling';
    case 'settling':
      return 'listening';
    // Listening = steady-state, dissolving = navigation-triggered; both
    // refuse auto-advance.
    case 'listening':
    case 'dissolving':
      return null;
  }
}

/** Pure: the delay (in ms) the hook should wait before advancing OUT of
 *  this phase. `listening` + `dissolving` return 0 because they don't
 *  participate in auto-advance — the hook will short-circuit on the
 *  null return from `nextPhaseInChain` before reading the delay. */
export function phaseDelayFor(phase: SurfaceLifecyclePhase, plan: LifecyclePlan): number {
  switch (phase) {
    case 'idle':
      return plan.idleHoldMs;
    case 'materialising':
      return plan.materialisingMs;
    case 'settling':
      return plan.settlingMs;
    case 'listening':
    case 'dissolving':
      return 0;
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
  const next = nextPhaseInChain(phase);
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
    const next = nextPhaseInChain(phase);
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
