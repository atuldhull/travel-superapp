/**
 * `<SurfaceAudioLayer>` — wires the AE2 `useAudioEngine()` to the AE374
 * Surface lifecycle, applying the AE376 `channelGainsAt` mixer every frame.
 *
 * Mount this once inside `<AetherProvider>` (which already mounts
 * `<AudioEngineProvider>`) and let it stay for the lifetime of the
 * session. The component itself renders nothing — it's a side-effect
 * layer that listens to the lifecycle clock and writes to the engine.
 *
 * The frame loop here uses `requestAnimationFrame` (not R3F's useFrame)
 * because:
 *   1. AE376 wants to work whether or not the route is currently rendering
 *      an R3F canvas (Pulse + Continuum are overlays; some surfaces may
 *      stay 2D for accessibility).
 *   2. The audio gain update needs to keep stepping even while the canvas
 *      is suspended (e.g. backgrounded tab — the audio engine itself is
 *      paused but the gain envelope state should still progress).
 *
 * Reduced-motion: when `useReducedMotion()` returns true, drone gain is
 * dropped one tier ("audio is a layer, not a load-bearing channel" —
 * 01-architecture.md §Audio).
 */
import { useEffect, useRef } from 'react';
import { useCurrentSurface, useMotionPolicy, useSurfaceLifecycle } from '@app/aether-core';
import { DRONE_DB, SILENCE_DB, channelGainsAt } from './scene-mixer';

/** Optional callback shape — consumers can subscribe to mixer changes
 *  for testing or analytics without rendering a UI. */
export type ChannelWriteFn = (gains: { drone: number; events: number }) => void;

export interface SurfaceAudioLayerProps {
  /** Override the eased-progress source. Default is a linear ramp at
   *  DEFAULT_PHASE_DURATIONS — caller can pass the AE375 driver's
   *  elapsed-in-phase for tight visual + audio sync. */
  onChannelWrite?: ChannelWriteFn;
  /**
   * Phase durations in seconds. Defaults to a 0.7s materialise + 0.5s
   * settle + 0.5s dissolve schedule — matches AE375's defaults so the
   * audio fade lands at the same instant the camera settles.
   */
  durations?: {
    readonly materialising: number;
    readonly settling: number;
    readonly dissolving: number;
  };
}

const DEFAULT_DURATIONS = {
  materialising: 0.7,
  settling: 0.5,
  dissolving: 0.5,
};

export function SurfaceAudioLayer({
  onChannelWrite,
  durations = DEFAULT_DURATIONS,
}: SurfaceAudioLayerProps): null {
  const phase = useSurfaceLifecycle();
  const current = useCurrentSurface();
  const motionPolicy = useMotionPolicy();

  const elapsedRef = useRef<number>(0);
  const lastTickRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // Re-zero elapsed-in-phase on phase or surface change.
  useEffect(() => {
    elapsedRef.current = 0;
    lastTickRef.current = null;
  }, [phase, current]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const tick = (now: number): void => {
      const last = lastTickRef.current;
      const dt = last === null ? 0 : Math.min((now - last) / 1000, 0.1);
      lastTickRef.current = now;
      elapsedRef.current += dt;

      // Pick the duration for the current phase (ambient phases use 1.0).
      const phaseDuration =
        phase === 'materialising'
          ? durations.materialising
          : phase === 'settling'
            ? durations.settling
            : phase === 'dissolving'
              ? durations.dissolving
              : 1.0;
      const progress = phaseDuration <= 0 ? 1 : Math.min(elapsedRef.current / phaseDuration, 1);

      const gains = channelGainsAt(phase, progress);
      // Respect reduced-motion + opt-out: drop drone one tier (or to
      // silence if it's already at floor).
      const droneAdj =
        motionPolicy === 'full' ? gains.drone : Math.max(SILENCE_DB, gains.drone - 6);
      const eventsAdj = motionPolicy === 'full' ? gains.events : SILENCE_DB;

      onChannelWrite?.({ drone: droneAdj, events: eventsAdj });

      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTickRef.current = null;
    };
  }, [phase, durations, motionPolicy, onChannelWrite]);

  return null;
}

/** Reference exports for the channel-floor constants. */
export { DRONE_DB, SILENCE_DB };
