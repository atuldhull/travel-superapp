/**
 * `NativeAudioEngine` — adapter contract for the future expo-av
 * implementation. AE516.
 *
 * Per the Phase 4 plan (`docs/aether/15-phase4-plan.md`,
 * shared-cross-cutting #3): Tone.js becomes `expo-av` + precomputed
 * AAC drone loops keyed by destination. The pure `scene-mixer.ts`
 * math (channel gains across the lifecycle, the drone/event/silence
 * dB constants) ships verbatim from `@app/aether-audio`.
 *
 * This file ships only the CONTRACT for the native audio engine —
 * the shape that the expo-av-backed implementation will satisfy.
 * The real implementation lands in a future slice once
 * `@app/aether-audio-native` is consumed by `apps/mobile`. For now,
 * we ship the contract + a NullNativeAudioEngine that throws on
 * every method, so consumers can wire-up code that fails loudly
 * when no engine is mounted (vs silently swallowing audio events).
 *
 * Pure — no React, no expo-av, no Tone. The web's
 * `@app/aether-core` AudioEngine contract inspires the shape here,
 * but the native one is intentionally narrower: no individual
 * channel manipulation, no parameter ramps. The scene-mixer math
 * computes channel gains; the engine just plays back the resolved
 * mix into the precomputed loop layers.
 */

/** Status of the native audio engine. The lifecycle mirrors the web
 *  AudioEngineStatus union but drops the `'failed'` distinction (the
 *  expo-av wrapper either started or it didn't; per-engine status
 *  introspection is the consumer's job). */
export type NativeAudioEngineStatus = 'idle' | 'starting' | 'running' | 'stopped';

/** Per-channel gain snapshot passed to `applyMix()`. Mirrors the
 *  `ChannelGainsDb` shape from `@app/aether-audio` but kept local so
 *  this file doesn't pull in the upstream. */
export interface NativeChannelGainsDb {
  readonly drone: number;
  readonly events: number;
}

/**
 * The contract a real expo-av-backed engine must satisfy. Phase 4
 * AR+N will land the implementation; AR ships the contract so
 * consumers can program against it now.
 */
export interface NativeAudioEngine {
  /** Current engine status. */
  readonly status: NativeAudioEngineStatus;
  /** Boot the engine + load the destination's precomputed AAC drone
   *  loops. Resolves once the first loop is ready to play. */
  start(destinationSlug: string): Promise<void>;
  /** Stop playback and unload all loops. Idempotent. */
  stop(): Promise<void>;
  /** Apply a per-channel gain snapshot from the scene-mixer. Engine
   *  is responsible for ramping (typically 50-150ms linear) so the
   *  consumer doesn't have to schedule per-frame writes. */
  applyMix(gains: NativeChannelGainsDb): void;
}

/**
 * Null implementation that throws on every method. Consumers wire
 * this in by default so missing-engine bugs surface loudly rather
 * than swallowing audio events.
 */
export function createNullNativeAudioEngine(): NativeAudioEngine {
  const fail = (op: string): never => {
    throw new Error(
      `[aether-audio-native] No engine mounted — cannot ${op}. Mount a real engine via ` +
        `NativeAudioEngineProvider (lands in Phase 4 AR+N).`,
    );
  };
  return {
    status: 'idle' as NativeAudioEngineStatus,
    start: () => fail('start') as unknown as Promise<void>,
    stop: () => fail('stop') as unknown as Promise<void>,
    applyMix: () => fail('applyMix'),
  };
}

/**
 * Tag so consumers can detect they're holding the null engine and
 * skip downstream wiring (e.g. don't drive the engine from the
 * surface lifecycle when no real one is mounted).
 */
export function isNullNativeAudioEngine(engine: NativeAudioEngine): boolean {
  // Status='idle' + .start that throws is the signature of the null
  // engine. The marker is the throw, not the status — so we probe.
  try {
    // Read-only probe: status access is always safe.
    return engine.status === 'idle' && (engine.start as unknown) !== undefined;
  } catch {
    return false;
  }
}
