/**
 * Surface lifecycle FSM — phase order + transition rules.
 *
 * Implements the five-step lifecycle defined in 02-surfaces.md §How surfaces
 * compose. Pure helpers only; no React, no timers. The provider in
 * `manager.tsx` calls these to step the FSM forward; the canvas package
 * (AE375) will gate animation phases on the resulting state.
 *
 * Transition graph:
 *
 *   idle ─────────┐
 *      │          ↑
 *      ↓          │
 *   materialising │
 *      ↓          │
 *   settling      │
 *      ↓          │
 *   listening ────┤
 *      ↓          │
 *   dissolving ───┘
 *
 * `listening` can also self-loop (re-enter on user interaction); we encode
 * that as `canTransition('listening', 'listening') === true`.
 */
import type { SurfaceLifecyclePhase } from './types';

/** Canonical forward order — index by phase, step with `nextLifecyclePhase`. */
export const SURFACE_PHASE_ORDER: ReadonlyArray<SurfaceLifecyclePhase> = [
  'idle',
  'materialising',
  'settling',
  'listening',
  'dissolving',
];

/** The phase a Surface advances to next on the forward path.
 *
 *  `dissolving → idle` closes the loop so a single Surface can re-materialise
 *  without the caller having to reset state manually. */
export function nextLifecyclePhase(current: SurfaceLifecyclePhase): SurfaceLifecyclePhase {
  switch (current) {
    case 'idle':
      return 'materialising';
    case 'materialising':
      return 'settling';
    case 'settling':
      return 'listening';
    case 'listening':
      return 'dissolving';
    case 'dissolving':
      return 'idle';
  }
}

/** True iff this phase is the loop's natural rest state (no ongoing animation).
 *
 *  AE375 uses this to decide when it's safe to unmount the R3F scene tree —
 *  only `idle` is truly safe to tear down. */
export function isTerminalPhase(p: SurfaceLifecyclePhase): boolean {
  return p === 'idle';
}

/** Whether a transition is legal. Forward steps on the canonical loop
 *  are legal; jumping directly from `settling` to `dissolving` is not.
 *
 *  The one extra allowance is `listening → listening` so consumers can
 *  signal "user interacted; replay the listen tick" without having to
 *  loop the whole FSM. */
export function canTransition(from: SurfaceLifecyclePhase, to: SurfaceLifecyclePhase): boolean {
  if (from === to) {
    return from === 'listening';
  }
  return nextLifecyclePhase(from) === to;
}
