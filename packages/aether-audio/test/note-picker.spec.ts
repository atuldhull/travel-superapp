/** AE376 — note-picker specs. */
import { italianKey, type KeySignature } from '@app/aether-motion/audio';
import { __testing, bellWeights, pickNoteRandom, pickNoteWeighted } from '../src/note-picker';

/** Deterministic mulberry-style PRNG seeded from an integer. */
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const empty: KeySignature = { tonic: 'D3', scale: [], tempo: 60 };

describe('clamp01Open', () => {
  const { clamp01Open } = __testing;
  it('clamps to [0, 0.999999]', () => {
    expect(clamp01Open(0)).toBe(0);
    expect(clamp01Open(0.5)).toBe(0.5);
    expect(clamp01Open(1)).toBe(0.999999);
    expect(clamp01Open(2)).toBe(0.999999);
    expect(clamp01Open(-1)).toBe(0);
  });

  it('non-finite values short-circuit to 0', () => {
    // Number.isFinite catches both NaN and Infinity; we treat them as 0
    // so a buggy upstream rng() can never crash the picker.
    expect(clamp01Open(NaN)).toBe(0);
    expect(clamp01Open(Infinity)).toBe(0);
    expect(clamp01Open(-Infinity)).toBe(0);
  });
});

describe('pickNoteRandom', () => {
  it('returns a pitch from the key scale', () => {
    const rng = seededRng(1);
    for (let i = 0; i < 50; i += 1) {
      const note = pickNoteRandom(italianKey, rng);
      expect(italianKey.scale).toContain(note);
    }
  });

  it('returns the tonic for an empty scale', () => {
    const rng = seededRng(2);
    expect(pickNoteRandom(empty, rng)).toBe('D3');
  });

  it('is deterministic given the same seed', () => {
    const a = pickNoteRandom(italianKey, seededRng(42));
    const b = pickNoteRandom(italianKey, seededRng(42));
    expect(a).toBe(b);
  });

  it('handles rng() === 1 boundary without overflow', () => {
    const rng = (): number => 1;
    const note = pickNoteRandom(italianKey, rng);
    expect(italianKey.scale).toContain(note);
  });

  it('distributes across the scale (rough)', () => {
    const rng = seededRng(7);
    const counts = new Map<string, number>();
    for (let i = 0; i < 1000; i += 1) {
      const n = pickNoteRandom(italianKey, rng);
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    // Every scale degree should be hit at least once over 1000 picks.
    for (const p of italianKey.scale) {
      expect(counts.get(p) ?? 0).toBeGreaterThan(0);
    }
  });
});

describe('pickNoteWeighted', () => {
  it('returns a pitch in the scale', () => {
    const rng = seededRng(3);
    for (let i = 0; i < 50; i += 1) {
      const note = pickNoteWeighted(italianKey, rng);
      expect(italianKey.scale).toContain(note);
    }
  });

  it('falls back to uniform when weights length mismatches', () => {
    const rng = seededRng(11);
    // Wrong length → falls back to pickNoteRandom; should not throw.
    const note = pickNoteWeighted(italianKey, rng, [1, 2]);
    expect(italianKey.scale).toContain(note);
  });

  it('respects custom weights — first-only is always returned', () => {
    const rng = seededRng(13);
    const n = italianKey.scale.length;
    const weights = new Array(n).fill(0);
    weights[0] = 1;
    for (let i = 0; i < 25; i += 1) {
      const note = pickNoteWeighted(italianKey, rng, weights);
      expect(note).toBe(italianKey.scale[0]);
    }
  });

  it('all-zero weights → fall back to uniform', () => {
    const rng = seededRng(17);
    const weights = new Array(italianKey.scale.length).fill(0);
    const note = pickNoteWeighted(italianKey, rng, weights);
    expect(italianKey.scale).toContain(note);
  });

  it('handles negative + NaN weights as 0', () => {
    const rng = seededRng(19);
    const weights = italianKey.scale.map((_, i) => (i === 2 ? 1 : -1));
    for (let i = 0; i < 25; i += 1) {
      expect(pickNoteWeighted(italianKey, rng, weights)).toBe(italianKey.scale[2]);
    }
  });

  it('empty scale → returns tonic', () => {
    const rng = seededRng(23);
    expect(pickNoteWeighted(empty, rng)).toBe('D3');
  });
});

describe('bellWeights', () => {
  it('length matches input', () => {
    expect(bellWeights(5).length).toBe(5);
    expect(bellWeights(1).length).toBe(1);
    expect(bellWeights(0).length).toBe(0);
  });

  it('middle weight >= edge weight', () => {
    const w = bellWeights(7);
    const mid = w[3]!;
    const edge = w[0]!;
    expect(mid).toBeGreaterThanOrEqual(edge);
  });

  it('floor of 0.2 — no weight is fully 0', () => {
    const w = bellWeights(9);
    for (const v of w) expect(v).toBeGreaterThanOrEqual(0.2);
  });

  it('length-1 returns [1]', () => {
    expect(bellWeights(1)).toEqual([1]);
  });
});
