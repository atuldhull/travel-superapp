'use client';

/**
 * `useLifecycleEvents` — subscribe to AE374/AE382 phase transitions
 * without hand-rolling `useEffect` + a previous-phase ref every time.
 *
 * Consumers pass per-phase callbacks; the hook calls them on the leading
 * edge of each transition. Callbacks are stored in a ref so they can be
 * inline literals without breaking memoisation downstream.
 *
 * Typical use cases:
 *   - Fire a Tone.js cue on settle (when the camera has landed) —
 *     onSettle: () => engine.tick()
 *   - Reset a scene-internal animation timer when the surface
 *     re-materialises — onMaterialise: () => resetClock()
 *   - Forward phase transitions to analytics — onListen: () => track('aether-surface-listening')
 *
 * Pure side-effect: returns nothing.
 */
import { useEffect, useRef } from 'react';
import { useSurfaceLifecycle, type SurfaceLifecyclePhase } from '@app/aether-core';

export interface LifecycleEventHandlers {
  /** Phase entered `materialising` from `idle`. */
  readonly onMaterialise?: () => void;
  /** Phase entered `settling` from `materialising`. */
  readonly onSettle?: () => void;
  /** Phase entered `listening` from `settling`. */
  readonly onListen?: () => void;
  /** Phase entered `dissolving` (from `listening` or external setPhase). */
  readonly onDissolve?: () => void;
  /** Phase returned to `idle` (from `dissolving` on a looping plan, or
   *  from a route change). */
  readonly onIdle?: () => void;
  /** Catch-all — fires on every phase change with `(next, prev)`. */
  readonly onAny?: (next: SurfaceLifecyclePhase, prev: SurfaceLifecyclePhase | null) => void;
}

/** Pure: pick the per-phase handler key for `next`. Tested
 *  independently of React so the dispatch table stays honest. */
export function handlerKeyForPhase(
  phase: SurfaceLifecyclePhase,
): keyof Omit<LifecycleEventHandlers, 'onAny'> {
  switch (phase) {
    case 'idle':
      return 'onIdle';
    case 'materialising':
      return 'onMaterialise';
    case 'settling':
      return 'onSettle';
    case 'listening':
      return 'onListen';
    case 'dissolving':
      return 'onDissolve';
  }
}

/**
 * Subscribe to lifecycle phase transitions. Handlers fire on the
 * leading edge of each phase (not on every render). `onAny` fires
 * for every transition; the per-phase callback for `next` fires
 * after `onAny` so consumers can use `onAny` as a global
 * pre-handler.
 *
 * On the very first render the hook fires the handler for whatever
 * the initial phase is (so a Surface that mounts already in
 * `materialising` still gets `onMaterialise`). Consumers that don't
 * want this can read the current phase manually before subscribing.
 */
export function useLifecycleEvents(handlers: LifecycleEventHandlers): void {
  const phase = useSurfaceLifecycle();
  const handlersRef = useRef<LifecycleEventHandlers>(handlers);
  const prevPhaseRef = useRef<SurfaceLifecyclePhase | null>(null);

  // Keep the handler ref fresh without re-running the effect below.
  // Without this, an inline handler would only fire with the initial
  // value (captured on first mount).
  handlersRef.current = handlers;

  useEffect(() => {
    const prev = prevPhaseRef.current;
    if (prev === phase) return;
    prevPhaseRef.current = phase;
    const h = handlersRef.current;
    h.onAny?.(phase, prev);
    const key = handlerKeyForPhase(phase);
    const cb = h[key];
    cb?.();
  }, [phase]);
}
