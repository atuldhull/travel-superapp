/**
 * @app/aether-audio — Phase 1 audio layer.
 *
 * Per-destination key signatures · in-scale note picker · lifecycle-driven
 * scene mixer · `<SurfaceAudioLayer>` React component that wires AE2's
 * Tone.js engine to AE374's Surface manager.
 *
 * Source-of-truth:
 *   • Key signatures: 01-architecture.md §Audio layer
 *   • Lifecycle gain envelope: 02-surfaces.md §How surfaces compose
 *   • Locked opt-in / mute behaviour: 06-decisions.md #4
 */
export {
  DESTINATION_KEYS,
  curatedSlugs,
  hasCuratedKey,
  keySignatureFor,
  type DestinationSlug,
} from './destination-keys';

export { bellWeights, pickNoteRandom, pickNoteWeighted, type Rng } from './note-picker';

export {
  DRONE_DB,
  EVENTS_DB,
  SILENCE_DB,
  channelGainsAt,
  dbToLinear,
  isChannelSilent,
  type ChannelGainsDb,
} from './scene-mixer';

export { useSurfaceKey } from './use-surface-key';
export {
  SurfaceAudioLayer,
  type ChannelWriteFn,
  type SurfaceAudioLayerProps,
} from './surface-audio-layer';
export {
  INITIAL_CHANNEL_SNAPSHOT,
  computeEdgeTransitions,
  hasAnyAction,
  type BridgeActions,
  type ChannelSnapshot,
} from './scene-audio-bridge';
export { useSceneAudioBridge, type SceneAudioBridge } from './use-scene-audio-bridge';
