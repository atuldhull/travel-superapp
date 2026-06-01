/**
 * AE516 — shape gate + NativeAudioEngine contract spec for
 * @app/aether-audio-native.
 *
 * Pins:
 * 1. Barrel resolves + version marker.
 * 2. Pure-math re-exports from @app/aether-audio flow through.
 * 3. NativeAudioEngine contract is exported (functions + types).
 * 4. createNullNativeAudioEngine returns an engine whose methods
 *    all throw (loud-fail behaviour).
 * 5. Tone.js-backed web hooks are NOT exported.
 */
import * as Native from '../src';

describe('AE516 — @app/aether-audio-native barrel', () => {
  it('exports the version marker', () => {
    expect(typeof Native.AETHER_AUDIO_NATIVE_VERSION).toBe('string');
    expect(Native.AETHER_AUDIO_NATIVE_VERSION.length).toBeGreaterThan(0);
  });

  it('re-exports the pure-math destination-keys surface', () => {
    expect(Native.DESTINATION_KEYS).toBeDefined();
    expect(typeof Native.keySignatureFor).toBe('function');
    expect(typeof Native.curatedSlugs).toBe('function');
    expect(typeof Native.hasCuratedKey).toBe('function');
  });

  it('re-exports the pure-math note-picker surface', () => {
    expect(typeof Native.bellWeights).toBe('function');
    expect(typeof Native.pickNoteRandom).toBe('function');
    expect(typeof Native.pickNoteWeighted).toBe('function');
  });

  it('re-exports the pure-math scene-mixer surface', () => {
    expect(typeof Native.channelGainsAt).toBe('function');
    expect(typeof Native.dbToLinear).toBe('function');
    expect(typeof Native.isChannelSilent).toBe('function');
    expect(typeof Native.DRONE_DB).toBe('number');
    expect(typeof Native.EVENTS_DB).toBe('number');
    expect(typeof Native.SILENCE_DB).toBe('number');
  });

  it('re-exports the pure-math scene-audio-bridge surface', () => {
    expect(Native.INITIAL_CHANNEL_SNAPSHOT).toBeDefined();
    expect(typeof Native.computeEdgeTransitions).toBe('function');
    expect(typeof Native.hasAnyAction).toBe('function');
  });
});

describe('AE516 — NativeAudioEngine contract', () => {
  it('exports createNullNativeAudioEngine', () => {
    expect(typeof Native.createNullNativeAudioEngine).toBe('function');
  });

  it('exports isNullNativeAudioEngine', () => {
    expect(typeof Native.isNullNativeAudioEngine).toBe('function');
  });

  it('null engine starts in idle status', () => {
    const engine = Native.createNullNativeAudioEngine();
    expect(engine.status).toBe('idle');
  });

  it('null engine start() rejects/throws with a missing-engine error', () => {
    const engine = Native.createNullNativeAudioEngine();
    expect(() => engine.start('jaipur')).toThrow(/No engine mounted/);
  });

  it('null engine stop() throws with a missing-engine error', () => {
    const engine = Native.createNullNativeAudioEngine();
    expect(() => engine.stop()).toThrow(/No engine mounted/);
  });

  it('null engine applyMix() throws with a missing-engine error', () => {
    const engine = Native.createNullNativeAudioEngine();
    expect(() => engine.applyMix({ drone: -12, events: -18 })).toThrow(/No engine mounted/);
  });

  it('isNullNativeAudioEngine returns true for the null engine', () => {
    const engine = Native.createNullNativeAudioEngine();
    expect(Native.isNullNativeAudioEngine(engine)).toBe(true);
  });
});

describe('AE516 — non-portable web hooks NOT re-exported', () => {
  it('SurfaceAudioLayer is not re-exported (Tone.js-backed, web-only)', () => {
    expect((Native as unknown as Record<string, unknown>).SurfaceAudioLayer).toBeUndefined();
  });

  it('useSurfaceKey is not re-exported', () => {
    expect((Native as unknown as Record<string, unknown>).useSurfaceKey).toBeUndefined();
  });

  it('useSceneAudioBridge is not re-exported', () => {
    expect((Native as unknown as Record<string, unknown>).useSceneAudioBridge).toBeUndefined();
  });
});
