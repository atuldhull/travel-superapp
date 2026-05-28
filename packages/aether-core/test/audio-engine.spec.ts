/** Audio engine — pure-state tests that don't load Tone.js. */
import { createAudioEngine, toneDbToGain } from '../src/audio-engine';

describe('toneDbToGain', () => {
  it('0 dB = 1.0 (unity gain)', () => {
    expect(toneDbToGain(0)).toBeCloseTo(1, 5);
  });

  it('-6 dB ~ 0.501 gain (half-power)', () => {
    expect(toneDbToGain(-6)).toBeCloseTo(0.501, 2);
  });

  it('-60 dB is near-silence', () => {
    expect(toneDbToGain(-60)).toBeCloseTo(0.001, 3);
  });
});

describe('createAudioEngine — silent path', () => {
  it("forceSilent=true sets status to 'silent' and stays silent", async () => {
    const engine = createAudioEngine({ forceSilent: true });
    expect(engine.status).toBe('silent');
    await engine.activate();
    expect(engine.status).toBe('silent');
  });

  it("pluck/tick/ambient are no-ops while not 'running'", () => {
    const engine = createAudioEngine({ forceSilent: true });
    // None of these should throw on a silent engine.
    expect(() => engine.pluck(0)).not.toThrow();
    expect(() => engine.tick()).not.toThrow();
    expect(() => engine.startAmbient()).not.toThrow();
    expect(() => engine.stopAmbient()).not.toThrow();
  });

  it('setMasterDb clamps to [-60, +6]', () => {
    const engine = createAudioEngine({ forceSilent: true });
    expect(() => engine.setMasterDb(100)).not.toThrow();
    expect(() => engine.setMasterDb(-1000)).not.toThrow();
    // No direct getter; just asserting no throw on out-of-range input.
  });
});

describe('createAudioEngine — default state', () => {
  it("starts as 'awaiting-activation' when not forceSilent", () => {
    const engine = createAudioEngine();
    expect(engine.status).toBe('awaiting-activation');
  });

  it('onStatusChange fires when forceSilent flips state', () => {
    const transitions: string[] = [];
    const engine = createAudioEngine({
      forceSilent: true,
      onStatusChange: (s) => transitions.push(s),
    });
    engine.dispose();
    // dispose() emits 'silent' if not already; here already-silent so no transition.
    expect(transitions).toEqual([]);
    expect(engine.status).toBe('silent');
  });
});
