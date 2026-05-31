/**
 * Vitest specs for AE300 shuffleWith.
 */
import { describe, expect, it } from 'vitest';
import { makeRng } from '../../src/lib/random-seed';
import { shuffleWith } from '../../src/lib/shuffle-deterministic';

const ITEMS = ['a', 'b', 'c', 'd', 'e'];

describe('shuffleWith', () => {
  it('same seed → same permutation', () => {
    const a = shuffleWith(ITEMS, makeRng(42));
    const b = shuffleWith(ITEMS, makeRng(42));
    expect(a).toEqual(b);
  });

  it('different seeds → likely different permutations', () => {
    const a = shuffleWith(ITEMS, makeRng(1));
    const b = shuffleWith(ITEMS, makeRng(999));
    // Not guaranteed for tiny lists, but extremely likely with these
    // two specific seeds.
    expect(a).not.toEqual(b);
  });

  it('returns a permutation (same set, possibly different order)', () => {
    const got = shuffleWith(ITEMS, makeRng(7));
    expect([...got].sort()).toEqual([...ITEMS].sort());
  });

  it('does NOT mutate the input', () => {
    const ref = ITEMS.slice();
    shuffleWith(ITEMS, makeRng(7));
    expect(ITEMS).toEqual(ref);
  });

  it('empty array → empty array', () => {
    expect(shuffleWith<string>([], makeRng(1))).toEqual([]);
  });

  it('single-element array → same array', () => {
    expect(shuffleWith(['only'], makeRng(1))).toEqual(['only']);
  });

  it('preserves length', () => {
    const got = shuffleWith(ITEMS, makeRng(11));
    expect(got.length).toBe(ITEMS.length);
  });

  it('all elements preserved exactly once', () => {
    const got = shuffleWith(ITEMS, makeRng(33));
    const counts = new Map<string, number>();
    for (const x of got) counts.set(x, (counts.get(x) ?? 0) + 1);
    for (const x of ITEMS) expect(counts.get(x)).toBe(1);
  });
});
