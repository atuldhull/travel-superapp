/**
 * Scene audio bridge — converts the AE376 mixer's per-frame dB output
 * into AudioEngine method calls (start/stop ambient, tick on event
 * rising edge, master volume tracking the drone gain).
 *
 * The bridge is split into two pieces:
 *   1. Pure computer (`computeEdgeTransitions`) — input is the previous
 *      and next channel gains; output is an "action plan" object. Easy
 *      to unit-test without React or Tone.
 *   2. React hook (`useSceneAudioBridge`, in scene-audio-bridge.tsx) —
 *      wires the computer to `useAudioEngine()` + returns a callback
 *      ready to hand to `<SurfaceAudioLayer onChannelWrite={...}>`.
 *
 * The pure file is `.ts` so it imports cleanly into node-env jest. The
 * React hook is in a sibling `.tsx`.
 */
import { SILENCE_DB } from './scene-mixer';

/** A snapshot of the most recent drone + events dB levels. */
export interface ChannelSnapshot {
  readonly drone: number;
  readonly events: number;
}

/** What the bridge wants the engine to do this tick. */
export interface BridgeActions {
  /** True iff the drone just rose from silence — engine should
   *  `startAmbient()`. */
  readonly startAmbient: boolean;
  /** True iff the drone just dropped back to silence — engine should
   *  `stopAmbient()`. */
  readonly stopAmbient: boolean;
  /** True iff events just rose from silence — engine should `tick()`
   *  (one micro-confirm). */
  readonly tick: boolean;
  /** New master dB to apply this tick. Null when no change is desired
   *  (drone is silent, so we leave whatever volume was set before). */
  readonly setMasterDb: number | null;
}

/** All-quiet starting snapshot used when the bridge initialises. */
export const INITIAL_CHANNEL_SNAPSHOT: ChannelSnapshot = {
  drone: SILENCE_DB,
  events: SILENCE_DB,
};

/** True iff this channel level is above the silence floor by even a
 *  hair. We allow the floor itself to count as silent (consumers can
 *  drive to exactly `SILENCE_DB` and have the engine stay off). */
function isAudible(db: number): boolean {
  return db > SILENCE_DB;
}

/**
 * Compute the engine actions to take given the previous + next channel
 * snapshots.
 *
 * Pure — no engine, no React, no Tone. The hook layers this over the
 * real `AudioEngine` from `@app/aether-core` and tests can drive it
 * directly with hand-rolled snapshots.
 */
export function computeEdgeTransitions(
  prev: ChannelSnapshot,
  next: ChannelSnapshot,
): BridgeActions {
  const wasDroneAudible = isAudible(prev.drone);
  const isDroneAudible = isAudible(next.drone);
  const wasEventsAudible = isAudible(prev.events);
  const isEventsAudible = isAudible(next.events);

  return {
    startAmbient: !wasDroneAudible && isDroneAudible,
    stopAmbient: wasDroneAudible && !isDroneAudible,
    tick: !wasEventsAudible && isEventsAudible,
    // Only push a master-dB change while the drone is audible; leaving
    // it untouched when the drone is silent avoids ramping the master
    // gain down to -60 (which would also mute future ticks until the
    // next drone rise).
    setMasterDb: isDroneAudible ? next.drone : null,
  };
}

/** True iff the actions object would cause any engine call. Cheap check
 *  the hook uses to short-circuit on no-op frames. */
export function hasAnyAction(actions: BridgeActions): boolean {
  return (
    actions.startAmbient || actions.stopAmbient || actions.tick || actions.setMasterDb !== null
  );
}
