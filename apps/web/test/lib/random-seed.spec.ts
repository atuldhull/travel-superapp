/**
 * Vitest specs for AE299 makeRng.
 */
import { describe, expect, it } from 'vitest';
import { makeRng } from '../../src/lib/random-seed';

describe('makeRng', () => {
  it('same seed → same sequence', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    expect(a.next()).toBe(b.next());
    expect(a.next()).toBe(b.next());
    expect(a.next()).toBe(b.next());
  });

  it('different seeds → different sequences', () => {
    const a = makeRng(1);
    const b = makeRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('next() always in [0, 1)', () => {
    const r = makeRng(99);
    for (let i = 0; i < 100; i++) {
      const n = r.next();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });

  it('nextInt(n) always in [0, n)', () => {
    const r = makeRng(7);
    for (let i = 0; i < 100; i++) {
      const n = r.nextInt(10);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(10);
      expect(Number.isInteger(n)).toBe(true);
    }
  });

  it('nextInt(0) → 0 (defensive)', () => {
    expect(makeRng(1).nextInt(0)).toBe(0);
  });

  it('nextInt(-5) → 0', () => {
    expect(makeRng(1).nextInt(-5)).toBe(0);
  });

  it('nextInt(NaN) → 0', () => {
    expect(makeRng(1).nextInt(Number.NaN)).toBe(0);
  });

  it('pick from empty array → null', () => {
    expect(makeRng(1).pick<string>([])).toBeNull();
  });

  it('pick from non-empty → an element', () => {
    const items = ['a', 'b', 'c'];
    const got = makeRng(123).pick(items);
    expect(items.includes(got as string)).toBe(true);
  });

  it('seed=0 falls back to non-pathological state (yields varied values)', () => {
    const r = makeRng(0);
    const s = new Set<number>();
    for (let i = 0; i < 5; i++) s.add(r.next());
    expect(s.size).toBe(5);
  });

  it('NaN seed treated as 0 (deterministic same as makeRng(0))', () => {
    const a = makeRng(Number.NaN);
    const b = makeRng(0);
    expect(a.next()).toBe(b.next());
  });
});
