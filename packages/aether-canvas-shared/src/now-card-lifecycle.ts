/**
 * Now Card lifecycle styling — pure helpers.
 *
 * AE385 ships the Drift Now Card as a static foreground overlay. AE386
 * binds its opacity to the AE382 lifecycle so the card breathes with the
 * surface:
 *
 *   idle           opacity 0   (card not yet visible)
 *   materialising  opacity 1   (CSS transition over materialisingMs)
 *   settling       opacity 1   (held)
 *   listening      opacity 1   (held)
 *   dissolving     opacity 0   (CSS transition over dissolvingMs)
 *
 * Using CSS transitions instead of rAF + setState keeps the card off the
 * React render loop — the browser interpolates opacity natively. The
 * pure helper here builds the inline style; the React layer in
 * `<DriftNowCard>` reads `useSurfaceLifecycle()` and applies the style.
 */
import type { SurfaceLifecyclePhase } from './surface-lifecycle-phase';

/** Tuned to match AE375 DEFAULT_PHASE_DURATIONS + AE382 dissolvingMs. */
export interface LifecycleDurationsMs {
  /** Materialising → settling (also the fade-in duration). */
  readonly materialisingMs: number;
  /** Settling. Used as the slow-shift duration for steady phases. */
  readonly settlingMs: number;
  /** Dissolving → idle (the fade-out duration). */
  readonly dissolvingMs: number;
}

export const DEFAULT_NOW_CARD_DURATIONS: LifecycleDurationsMs = {
  materialisingMs: 700,
  settlingMs: 500,
  dissolvingMs: 500,
};

/** Pure: opacity to apply for this phase. */
export function nowCardOpacityForPhase(phase: SurfaceLifecyclePhase): number {
  switch (phase) {
    case 'idle':
      return 0;
    case 'materialising':
    case 'settling':
    case 'listening':
      return 1;
    case 'dissolving':
      return 0;
  }
}

/** Pure: scale factor for the card. Subtle — the card grows by 4% from
 *  idle to listening so it feels like it's leaning forward. Listening
 *  holds at the settled scale. */
export function nowCardScaleForPhase(phase: SurfaceLifecyclePhase): number {
  switch (phase) {
    case 'idle':
      return 0.96;
    case 'materialising':
    case 'settling':
    case 'listening':
      return 1;
    case 'dissolving':
      return 0.96;
  }
}

/** Pure: CSS transition duration in ms to apply during this phase. */
export function nowCardTransitionMs(
  phase: SurfaceLifecyclePhase,
  durations: LifecycleDurationsMs = DEFAULT_NOW_CARD_DURATIONS,
): number {
  switch (phase) {
    case 'idle':
      // Snap-back to invisible — instant so the card disappears the moment
      // the FSM resets, before materialising starts the fade-in.
      return 0;
    case 'materialising':
      return durations.materialisingMs;
    case 'settling':
      // Keep small for the steady held-state; settle changes opacity but
      // the easing covers any visual jump.
      return durations.settlingMs;
    case 'listening':
      // Slow background drift in case the destination palette changes.
      return durations.settlingMs;
    case 'dissolving':
      return durations.dissolvingMs;
  }
}

/** Pure: build the full CSS style for the card given the phase. The
 *  React layer spreads this into the card's `style` prop. */
export function nowCardCssForPhase(
  phase: SurfaceLifecyclePhase,
  durations: LifecycleDurationsMs = DEFAULT_NOW_CARD_DURATIONS,
): { readonly opacity: number; readonly transform: string; readonly transition: string } {
  const opacity = nowCardOpacityForPhase(phase);
  const scale = nowCardScaleForPhase(phase);
  const ms = nowCardTransitionMs(phase, durations);
  // The transform here composes onto whatever the consumer applies in
  // its container style; the card's container already uses translate to
  // position itself, so we re-state it here to keep both translate + scale.
  const transform = `translate(-50%, -160%) scale(${scale.toFixed(3)})`;
  // Ease-out for materialising/settling (matches AE375 ease-out cubic),
  // ease-in for dissolving so the disappear accelerates.
  const easing =
    phase === 'dissolving'
      ? 'cubic-bezier(0.55, 0, 1, 0.45)' // ease-in (cubic)
      : 'cubic-bezier(0.16, 1, 0.3, 1)'; // ease-out
  const transition = `opacity ${ms}ms ${easing}, transform ${ms}ms ${easing}`;
  return { opacity, transform, transition };
}
