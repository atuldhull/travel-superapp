/**
 * @app/aether-audio-native — Aether 2.0 audio for React Native.
 *
 * Phase 4 (mobile parity) foundation package. AE516 first cut.
 *
 * Per the Phase 4 plan (`docs/aether/15-phase4-plan.md`,
 * shared-cross-cutting #3): Tone.js (web) becomes expo-av (native) +
 * precomputed AAC drone loops keyed by destination. The pure math
 * (destination keys / note picker / scene mixer / scene-audio-bridge)
 * ships verbatim from `@app/aether-audio` since none of it touches
 * Tone — it's pure dB constants + gain envelopes + key/note maps.
 *
 * AE516 ships:
 *   1. Re-export of the pure-math surface from `@app/aether-audio`
 *      (DESTINATION_KEYS, bellWeights, channelGainsAt, etc.).
 *   2. The `NativeAudioEngine` contract that the future expo-av
 *      implementation will satisfy.
 *   3. A `createNullNativeAudioEngine()` that throws on every method
 *      so consumers fail loudly when no real engine is mounted.
 *
 * The React hooks + `<SurfaceAudioLayer>` are intentionally NOT
 * re-exported — they wire to the web's Tone.js-backed
 * `@app/aether-core` AudioEngine, which doesn't apply to native.
 * The native equivalents land in a future slice once apps/mobile is
 * ready to consume them.
 */

// ----- Pure math re-exports from @app/aether-audio -----

export {
  DESTINATION_KEYS,
  curatedSlugs,
  hasCuratedKey,
  keySignatureFor,
  type DestinationSlug,
} from '@app/aether-audio';

export { bellWeights, pickNoteRandom, pickNoteWeighted, type Rng } from '@app/aether-audio';

export {
  DRONE_DB,
  EVENTS_DB,
  SILENCE_DB,
  channelGainsAt,
  dbToLinear,
  isChannelSilent,
  type ChannelGainsDb,
} from '@app/aether-audio';

export {
  INITIAL_CHANNEL_SNAPSHOT,
  computeEdgeTransitions,
  hasAnyAction,
  type BridgeActions,
  type ChannelSnapshot,
} from '@app/aether-audio';

// ----- Native-only additions -----

export {
  createNullNativeAudioEngine,
  isNullNativeAudioEngine,
  type NativeAudioEngine,
  type NativeAudioEngineStatus,
  type NativeChannelGainsDb,
} from './native-audio-engine';

/** Package version marker — tests pin this to confirm the barrel
 *  resolves. */
export const AETHER_AUDIO_NATIVE_VERSION = '0.0.1';
