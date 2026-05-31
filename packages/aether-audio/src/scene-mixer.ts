/**
 * Scene mixer — maps Surface lifecycle phase + progress to channel gains.
 *
 * Two channels per Surface in Phase 1:
 *   • drone — the surface's ambient pad (loops in the destination's key).
 *   • events — confirms, hovers, micro-interactions.
 *
 * The mixer expresses gains in dB (Tone.js native unit). Use `dbToLinear`
 * if a consumer needs the linear gain instead.
 *
 *   Phase            Drone        Events
 *   idle             -60 (mute)   -60
 *   materialising    -∞ → -12     -∞
 *   settling         -12          -12 → -6
 *   listening        -12          -6   (active surface)
 *   dissolving       -12 → -∞     -∞
 *
 *   "-∞" is represented as the channel-mute floor (-60 dB) so we don't
 *   ship literal Infinity to Tone, which would error.
 *
 * Pure — no React, no Tone. The React layer calls this each frame with
 * the current phase + eased progress (from AE375's `easedPhaseProgress`)
 * and writes the result to the engine.
 */
import type { SurfaceLifecyclePhase } from '@app/aether-core';

/** Channel-mute floor — anything quieter than this is "off". */
export const SILENCE_DB = -60;

/** Reference "audible but background" volume — the drone's normal level. */
export const DRONE_DB = -12;

/** Reference "audible foreground" volume — confirms during listening. */
export const EVENTS_DB = -6;

export interface ChannelGainsDb {
  /** Drone (ambient pad) gain in dB. */
  readonly drone: number;
  /** Events channel gain in dB. */
  readonly events: number;
}

/**
 * Compute drone + events gains for the given phase + 0..1 progress.
 * `progress` should be the eased progress from `@app/aether-canvas`'s
 * `easedPhaseProgress` — feeding linear progress also works but the fade
 * shapes will be more abrupt.
 */
export function channelGainsAt(phase: SurfaceLifecyclePhase, progress: number): ChannelGainsDb {
  const p = clamp01(progress);
  switch (phase) {
    case 'idle':
      return { drone: SILENCE_DB, events: SILENCE_DB };
    case 'materialising':
      // Drone fades in from silence → drone level; events stay quiet so
      // the user hears the surface arrive before the first confirm.
      return {
        drone: lerp(SILENCE_DB, DRONE_DB, p),
        events: SILENCE_DB,
      };
    case 'settling':
      // Drone is at level; events crossfade up to active.
      return {
        drone: DRONE_DB,
        events: lerp(SILENCE_DB, EVENTS_DB, p),
      };
    case 'listening':
      // Active surface — both at their reference levels.
      return { drone: DRONE_DB, events: EVENTS_DB };
    case 'dissolving':
      // Drone fades out; events go to silence so user transitions in
      // clean visual + audio.
      return {
        drone: lerp(DRONE_DB, SILENCE_DB, p),
        events: SILENCE_DB,
      };
  }
}

/** True iff the audio channels are silent (both at SILENCE_DB). The
 *  React layer uses this to release the audio engine voice when the
 *  surface is fully quiet. */
export function isChannelSilent(gains: ChannelGainsDb): boolean {
  return gains.drone <= SILENCE_DB && gains.events <= SILENCE_DB;
}

/** Linear gain (0..~1+ depending on dB). Tone.js accepts dB directly so
 *  most callers don't need this; useful for HTMLAudio fallback paths. */
export function dbToLinear(db: number): number {
  if (db <= SILENCE_DB) return 0;
  return Math.pow(10, db / 20);
}

/** Linear interpolation. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Test-only exports. */
export const __testing = { lerp, clamp01 };
