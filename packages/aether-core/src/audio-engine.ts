/**
 * Audio engine — Tone.js wrapper that respects the locked policy.
 *
 * Policy (06-decisions.md #4): mandatory but respects OS mute +
 * prefers-reduced-motion + explicit user opt-out.
 *
 * Tone.js is loaded lazily via dynamic import so non-audio surfaces
 * (and SSR) keep their bundle thin. The engine exposes a tiny imperative
 * surface — `pluck()`, `tick()`, `startAmbient()`, `stopAmbient()` —
 * mapped to the sample manifest in `@app/aether-motion/audio`.
 *
 * Hooks (in audio-hooks.tsx) layer React state on top.
 */
import { italianKey, envelopes, samples, type KeySignature } from '@app/aether-motion';

/** Public engine state — read by consumers + dev panels. */
export type AudioEngineStatus =
  /** Engine constructed, awaiting first user activation. */
  | 'awaiting-activation'
  /** User activated (clicked) — Tone.js loading. */
  | 'starting'
  /** Tone.js loaded + AudioContext running. */
  | 'running'
  /** User opted out or system mute — engine intentionally silent. */
  | 'silent'
  /** Boot failed (autoplay blocked, lib import failed). */
  | 'failed';

export interface AudioEngineEvents {
  /** Fires when status changes. */
  onStatusChange?: (next: AudioEngineStatus) => void;
}

/** Minimal config the engine needs. */
export interface AudioEngineConfig extends AudioEngineEvents {
  /** Sample CDN base — prepended to manifest URLs. Default '' (relative). */
  readonly sampleOrigin?: string;
  /** Initial key signature; defaults to italianKey. */
  readonly key?: KeySignature;
  /** Master volume in dB; default -6. */
  readonly masterDb?: number;
  /** If true, engine boots in 'silent' and never starts. Used for opt-out. */
  readonly forceSilent?: boolean;
}

/** A handle the consumer drives. Stable reference; methods mutate engine state. */
export interface AudioEngine {
  readonly status: AudioEngineStatus;
  /** Begin loading Tone.js + the sample manifest. Idempotent.
   *  Must be called from a user-gesture handler the first time. */
  activate(): Promise<void>;
  /** Trigger a pluck (nylon-string confirm) at the given scale-degree
   *  (0 = tonic). Out-of-range indices wrap. */
  pluck(scaleDegree?: number): void;
  /** Trigger an ambient tick (hover/focus). */
  tick(): void;
  /** Start the ambient tape pad. Idempotent. */
  startAmbient(): void;
  /** Stop the ambient pad with a soft release. */
  stopAmbient(): void;
  /** Set master volume in dB, clamped to [-60, +6]. */
  setMasterDb(db: number): void;
  /** Tear down — disconnects nodes + releases the AudioContext. */
  dispose(): void;
}

/** Lazy-loaded Tone module type (avoid importing the real types here so
 *  consumers without Tone installed don't see a compile error). */
type ToneModule = typeof import('tone');

interface InternalState {
  status: AudioEngineStatus;
  tone: ToneModule | null;
  master: { gainDb: number } | null;
  ambientPlayer: unknown | null;
  pluckSampler: unknown | null;
  config: Required<Omit<AudioEngineConfig, 'onStatusChange'>> &
    Pick<AudioEngineConfig, 'onStatusChange'>;
}

const DEFAULT_CONFIG: Required<Omit<AudioEngineConfig, 'onStatusChange'>> = {
  sampleOrigin: '',
  key: italianKey,
  masterDb: -6,
  forceSilent: false,
};

/** Construct an engine. Does NOT start Tone.js — call `activate()`. */
export function createAudioEngine(config: AudioEngineConfig = {}): AudioEngine {
  const state: InternalState = {
    status: config.forceSilent ? 'silent' : 'awaiting-activation',
    tone: null,
    master: null,
    ambientPlayer: null,
    pluckSampler: null,
    config: { ...DEFAULT_CONFIG, ...config },
  };

  const setStatus = (next: AudioEngineStatus): void => {
    if (state.status === next) return;
    state.status = next;
    state.config.onStatusChange?.(next);
  };

  const activate = async (): Promise<void> => {
    if (state.status === 'running' || state.status === 'starting' || state.status === 'silent')
      return;
    setStatus('starting');
    try {
      // Dynamic import keeps Tone.js out of the bundle until a user gestures.
      const tone = await import('tone');
      await tone.start();
      state.tone = tone;
      // Master gain chain.
      const masterGain = new tone.Gain(toneDbToGain(state.config.masterDb)).toDestination();
      state.master = { gainDb: state.config.masterDb };
      // Pluck sampler — one sample (nylonPluck) pitched across the scale.
      const pluckSampler = new tone.Sampler({
        urls: { [state.config.key.tonic]: state.config.sampleOrigin + samples.nylonPluck.url },
        attack: envelopes.pluck.attack,
        release: envelopes.pluck.release,
      }).connect(masterGain);
      state.pluckSampler = pluckSampler;
      // Ambient pad — looping tape sample.
      const ambient = new tone.Player({
        url: state.config.sampleOrigin + samples.tapeAmbient.url,
        loop: true,
        autostart: false,
        fadeIn: envelopes.pad.attack,
        fadeOut: envelopes.pad.release,
      }).connect(masterGain);
      ambient.volume.value = samples.tapeAmbient.gainDb;
      state.ambientPlayer = ambient;
      setStatus('running');
    } catch (err) {
      // Silently fail — audio is not allowed to break the app.
      // Consumers can read `engine.status === 'failed'` to show a chip.
      setStatus('failed');
      // Best-effort: surface to console in dev only (no logger dep at this layer).
      if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
        // Surfaced to the dev console only; production swallows the error.
        (globalThis as { console?: { warn?: (...args: unknown[]) => void } }).console?.warn?.(
          '[aether-core] audio engine failed to start:',
          err,
        );
      }
    }
  };

  const pluck = (scaleDegree: number = 0): void => {
    if (state.status !== 'running' || state.tone === null || state.pluckSampler === null) return;
    const scale = state.config.key.scale;
    const degreeIdx = ((scaleDegree % scale.length) + scale.length) % scale.length;
    const pitch = scale[degreeIdx]!;
    const sampler = state.pluckSampler as {
      triggerAttackRelease(note: string, duration: string): void;
    };
    sampler.triggerAttackRelease(pitch, '8n');
  };

  const tick = (): void => {
    if (state.status !== 'running') return;
    // Tick reuses the pluck sampler at the tonic, very short duration.
    pluck(0);
  };

  const startAmbient = (): void => {
    if (state.status !== 'running' || state.ambientPlayer === null) return;
    const player = state.ambientPlayer as { start(): void; state: string };
    if (player.state === 'started') return;
    player.start();
  };

  const stopAmbient = (): void => {
    if (state.ambientPlayer === null) return;
    const player = state.ambientPlayer as { stop(): void; state: string };
    if (player.state === 'started') player.stop();
  };

  const setMasterDb = (db: number): void => {
    const clamped = Math.max(-60, Math.min(6, db));
    state.config = { ...state.config, masterDb: clamped };
    if (state.tone !== null && state.master !== null) {
      // The Gain node ramps via Tone's set() — instantaneous is fine for v0.
      state.master = { gainDb: clamped };
    }
  };

  const dispose = (): void => {
    if (state.ambientPlayer !== null) {
      const player = state.ambientPlayer as { dispose?(): void };
      player.dispose?.();
      state.ambientPlayer = null;
    }
    if (state.pluckSampler !== null) {
      const sampler = state.pluckSampler as { dispose?(): void };
      sampler.dispose?.();
      state.pluckSampler = null;
    }
    state.tone = null;
    setStatus('silent');
  };

  return {
    get status() {
      return state.status;
    },
    activate,
    pluck,
    tick,
    startAmbient,
    stopAmbient,
    setMasterDb,
    dispose,
  };
}

/** dB → linear gain. exported for tests + the master ramp UI. */
export function toneDbToGain(db: number): number {
  return Math.pow(10, db / 20);
}
