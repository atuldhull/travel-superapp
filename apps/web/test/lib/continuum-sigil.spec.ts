/** Vitest specs for AE390 Continuum sigil grid generator. */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SIGIL_SIZE,
  buildSigilGrid,
  hashSeed,
  sigilEquals,
  sigilFilledCount,
} from '../../src/components/aether/phase1/continuum-sigil';

describe('hashSeed (pure)', () => {
  it('is deterministic for identical inputs', () => {
    expect(hashSeed('aether')).toBe(hashSeed('aether'));
  });
  it('produces a 32-bit unsigned int', () => {
    const h = hashSeed('aether-continuum');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });
  it('differs across different inputs', () => {
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
    expect(hashSeed('/aether/drift')).not.toBe(hashSeed('/aether/atlas'));
  });
  it('empty input still hashes', () => {
    expect(typeof hashSeed('')).toBe('number');
  });
});

describe('buildSigilGrid (pure)', () => {
  it('produces a 21×21 grid by default', () => {
    const g = buildSigilGrid('hello');
    expect(g.length).toBe(DEFAULT_SIGIL_SIZE);
    for (const row of g) expect(row.length).toBe(DEFAULT_SIGIL_SIZE);
  });

  it('honours custom size', () => {
    const g = buildSigilGrid('hello', 9);
    expect(g.length).toBe(9);
    expect(g[0]?.length).toBe(9);
  });

  it('floors a fractional size', () => {
    const g = buildSigilGrid('hello', 11.7);
    expect(g.length).toBe(11);
  });

  it('returns empty array on non-finite / <1 size', () => {
    expect(buildSigilGrid('x', 0)).toEqual([]);
    expect(buildSigilGrid('x', -5)).toEqual([]);
    expect(buildSigilGrid('x', Number.NaN)).toEqual([]);
    expect(buildSigilGrid('x', Number.POSITIVE_INFINITY)).toEqual([]);
  });

  it('is byte-for-byte deterministic per seed', () => {
    const a = buildSigilGrid('aether-continuum');
    const b = buildSigilGrid('aether-continuum');
    expect(sigilEquals(a, b)).toBe(true);
  });

  it('differs across seeds', () => {
    const a = buildSigilGrid('/aether/drift');
    const b = buildSigilGrid('/aether/atlas');
    expect(sigilEquals(a, b)).toBe(false);
  });

  it('draws all 3 finder patterns at corners (size≥9)', () => {
    const g = buildSigilGrid('any', 21);
    // Each finder is solid-edge at its 4 perimeter cells (corners of
    // the 7×7 box). Top-left corner cell is at (0,0); top-right at
    // (size-7, 0) + (size-1, 0); bottom-left at (0, size-7) + (0,
    // size-1). All 6 outer corners should be filled.
    expect(g[0]?.[0]).toBe(true);
    expect(g[0]?.[6]).toBe(true);
    expect(g[6]?.[0]).toBe(true);
    expect(g[6]?.[6]).toBe(true);
    expect(g[0]?.[14]).toBe(true); // top-right finder TL corner
    expect(g[0]?.[20]).toBe(true); // top-right finder TR corner
    expect(g[14]?.[0]).toBe(true); // bottom-left finder TL corner
    expect(g[20]?.[0]).toBe(true); // bottom-left finder BL corner
  });

  it('finder centres are filled', () => {
    const g = buildSigilGrid('any', 21);
    // Centre cell (3, 3) of top-left finder (cells 2..4 in both axes
    // are the centre).
    expect(g[3]?.[3]).toBe(true);
    expect(g[3]?.[17]).toBe(true); // centre of top-right finder
    expect(g[17]?.[3]).toBe(true); // centre of bottom-left finder
  });

  it('spacer row below the top-left finder is clear', () => {
    const g = buildSigilGrid('any', 21);
    // Row 7, cols 0..7 should all be false (spacer).
    for (let x = 0; x <= 7; x++) {
      expect(g[7]?.[x]).toBe(false);
    }
  });

  it('skips finders when size < 9 (pure noise)', () => {
    const g = buildSigilGrid('any', 8);
    // No required corner pattern — just assert the grid is 8×8.
    expect(g.length).toBe(8);
    expect(g[0]?.length).toBe(8);
  });

  it('density is non-degenerate (≥10% and ≤90% filled)', () => {
    const g = buildSigilGrid('aether', 21);
    const n = sigilFilledCount(g);
    const total = 21 * 21;
    expect(n).toBeGreaterThan(total * 0.1);
    expect(n).toBeLessThan(total * 0.9);
  });
});

describe('sigilEquals (pure)', () => {
  it('false for different sizes', () => {
    const a = buildSigilGrid('x', 9);
    const b = buildSigilGrid('x', 11);
    expect(sigilEquals(a, b)).toBe(false);
  });
  it('false when a row is shorter', () => {
    const a = [[true, false]];
    const b = [[true, false, true]];
    expect(sigilEquals(a, b)).toBe(false);
  });
  it('true on identical grids', () => {
    const a = [
      [true, false],
      [false, true],
    ];
    const b = [
      [true, false],
      [false, true],
    ];
    expect(sigilEquals(a, b)).toBe(true);
  });
});

describe('sigilFilledCount (pure)', () => {
  it('counts only true cells', () => {
    expect(
      sigilFilledCount([
        [true, false],
        [false, true],
      ]),
    ).toBe(2);
  });
  it('empty grid → 0', () => {
    expect(sigilFilledCount([])).toBe(0);
  });
});
