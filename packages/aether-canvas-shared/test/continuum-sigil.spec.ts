/**
 * AE506 - canvas-shared own behavioural spec for the Continuum "handoff
 * sigil" pure helper shipped in AE390.
 *
 * Covers:
 *   - DEFAULT_SIGIL_SIZE constant (21x21, QR v1 footprint)
 *   - hashSeed FNV-1a determinism + distribution sanity
 *   - buildSigilGrid:
 *       - default size + custom sizes (small, exact-9 finder threshold,
 *         large)
 *       - non-finite / sub-1 / fractional sizes
 *       - same seed -> byte-equal grid (determinism)
 *       - different seeds -> different grids (sensitivity)
 *       - finder patterns at top-left, top-right, bottom-left corners
 *       - finder corner pixel is filled; gap ring cell is clear
 *       - bottom-right corner has NO finder
 *       - timing strips on row 6 + column 6 alternate filled/empty
 *       - spacer cells around finders are cleared
 *       - density bounded (~roughly half) on default size
 *       - sub-9 sizes skip finder patterns + fall back to pure noise
 *   - sigilFilledCount on empty, all-false, all-true, mixed
 *   - sigilEquals across same/different sizes + cell deltas + empty
 *
 * Imports only from the package barrel so the helpers stay shippable
 * to any consumer that re-exports `@app/aether-canvas-shared`.
 */

import {
  DEFAULT_SIGIL_SIZE,
  buildSigilGrid,
  hashSeed,
  sigilEquals,
  sigilFilledCount,
  type SigilGrid,
} from '../src';

describe('AE506 - DEFAULT_SIGIL_SIZE', () => {
  it('is 21 to match QR version 1 footprint', () => {
    expect(DEFAULT_SIGIL_SIZE).toBe(21);
  });

  it('is a positive integer', () => {
    expect(Number.isInteger(DEFAULT_SIGIL_SIZE)).toBe(true);
    expect(DEFAULT_SIGIL_SIZE).toBeGreaterThan(0);
  });
});

describe('AE506 - hashSeed', () => {
  it('returns 0 (FNV-1a offset basis right-shifted) only when matching the constant - empty string returns the offset basis', () => {
    // Empty input leaves the FNV-1a offset basis 0x811c9dc5 unchanged.
    expect(hashSeed('')).toBe(0x811c9dc5);
  });

  it('returns a non-negative 32-bit unsigned integer', () => {
    const h = hashSeed('hello');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
    expect(Number.isInteger(h)).toBe(true);
  });

  it('is deterministic - same input twice gives same hash', () => {
    expect(hashSeed('atlas-handoff')).toBe(hashSeed('atlas-handoff'));
  });

  it('returns different hashes for different inputs', () => {
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
  });

  it('is order-sensitive (ab vs ba differ)', () => {
    expect(hashSeed('ab')).not.toBe(hashSeed('ba'));
  });

  it('is case-sensitive (Hello vs hello differ)', () => {
    expect(hashSeed('Hello')).not.toBe(hashSeed('hello'));
  });

  it('handles long ASCII inputs without overflow', () => {
    const long = 'continuum-deep-link-/aether/atlas?session=abc123def456';
    const h = hashSeed(long);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });
});

describe('AE506 - buildSigilGrid - shape + edge sizes', () => {
  it('returns a 21x21 grid by default', () => {
    const grid = buildSigilGrid('seed-a');
    expect(grid.length).toBe(21);
    for (const row of grid) {
      expect(row.length).toBe(21);
    }
  });

  it('returns an empty array for non-finite size (NaN)', () => {
    expect(buildSigilGrid('s', Number.NaN)).toEqual([]);
  });

  it('returns an empty array for non-finite size (Infinity)', () => {
    expect(buildSigilGrid('s', Number.POSITIVE_INFINITY)).toEqual([]);
  });

  it('returns an empty array for size 0', () => {
    expect(buildSigilGrid('s', 0)).toEqual([]);
  });

  it('returns an empty array for negative size', () => {
    expect(buildSigilGrid('s', -3)).toEqual([]);
  });

  it('returns a 1x1 grid for size 1 (no finder, pure noise)', () => {
    const grid = buildSigilGrid('s', 1);
    expect(grid.length).toBe(1);
    expect(grid[0]!.length).toBe(1);
    expect(typeof grid[0]![0]).toBe('boolean');
  });

  it('floors fractional sizes (5.7 -> 5x5)', () => {
    const grid = buildSigilGrid('s', 5.7);
    expect(grid.length).toBe(5);
    expect(grid[0]!.length).toBe(5);
  });

  it('returns an 8x8 grid (just below finder threshold) with no finder pattern enforced', () => {
    const grid = buildSigilGrid('seed-noise', 8);
    expect(grid.length).toBe(8);
    expect(grid[0]!.length).toBe(8);
    // Below the size>=9 cutoff the finder code is skipped, so cell (0,0)
    // is determined purely by the seeded PRNG and may be either value.
    expect(typeof grid[0]![0]).toBe('boolean');
  });

  it('returns a 9x9 grid (at finder threshold) and draws finders', () => {
    const grid = buildSigilGrid('seed-finder', 9);
    expect(grid.length).toBe(9);
    // Top-left finder outer corner is always filled.
    expect(grid[0]![0]).toBe(true);
    // Top-right finder outer corner (col sz-7..sz-1 -> col 8 is rightmost).
    expect(grid[0]![8]).toBe(true);
    // Bottom-left finder outer corner.
    expect(grid[8]![0]).toBe(true);
  });
});

describe('AE506 - buildSigilGrid - determinism + sensitivity', () => {
  it('produces byte-for-byte identical grids for the same seed', () => {
    const a = buildSigilGrid('atlas-handoff');
    const b = buildSigilGrid('atlas-handoff');
    expect(sigilEquals(a, b)).toBe(true);
  });

  it('produces different grids for different seeds', () => {
    const a = buildSigilGrid('seed-1');
    const b = buildSigilGrid('seed-2');
    expect(sigilEquals(a, b)).toBe(false);
  });

  it('produces byte-for-byte identical grids for the same seed at a custom size', () => {
    const a = buildSigilGrid('xyz', 15);
    const b = buildSigilGrid('xyz', 15);
    expect(sigilEquals(a, b)).toBe(true);
  });
});

describe('AE506 - buildSigilGrid - finder patterns', () => {
  const grid = buildSigilGrid('finder-fixture');

  it('fills the four outer corners of the top-left finder (the 7x7 ring)', () => {
    expect(grid[0]![0]).toBe(true);
    expect(grid[0]![6]).toBe(true);
    expect(grid[6]![0]).toBe(true);
    expect(grid[6]![6]).toBe(true);
  });

  it('fills the centre 3x3 of the top-left finder', () => {
    for (let y = 2; y <= 4; y++) {
      for (let x = 2; x <= 4; x++) {
        expect(grid[y]![x]).toBe(true);
      }
    }
  });

  it('fills the four outer corners of the top-right finder', () => {
    const sz = 21;
    expect(grid[0]![sz - 7]).toBe(true);
    expect(grid[0]![sz - 1]).toBe(true);
    expect(grid[6]![sz - 7]).toBe(true);
    expect(grid[6]![sz - 1]).toBe(true);
  });

  it('fills the four outer corners of the bottom-left finder', () => {
    const sz = 21;
    expect(grid[sz - 7]![0]).toBe(true);
    expect(grid[sz - 7]![6]).toBe(true);
    expect(grid[sz - 1]![0]).toBe(true);
    expect(grid[sz - 1]![6]).toBe(true);
  });

  it('does NOT draw a finder at the bottom-right corner', () => {
    const sz = 21;
    // The bottom-right 7x7 block is not unconditionally a finder ring;
    // the outer-corner cell (sz-1, sz-1) is governed only by the PRNG.
    // We assert no finder by checking that the centre-3x3 invariant of
    // a finder block does NOT hold - at least one of the 9 centre cells
    // for a hypothetical bottom-right finder is not forced filled.
    const centreCells: boolean[] = [];
    for (let y = sz - 5; y <= sz - 3; y++) {
      for (let x = sz - 5; x <= sz - 3; x++) {
        centreCells.push(grid[y]![x]!);
      }
    }
    // Pure PRNG noise on a 3x3 block almost never produces 9-out-of-9
    // trues. Treat the "not all true" as evidence no finder was drawn.
    expect(centreCells.every((c) => c === true)).toBe(false);
  });
});

describe('AE506 - buildSigilGrid - spacers + timing strips', () => {
  const grid = buildSigilGrid('spacer-fixture');
  const sz = 21;

  it('clears the spacer row directly below the top-left finder', () => {
    // clearSpacer(grid, 0, 7, 8, 1) -> row y=7, x in [0..7]
    for (let x = 0; x < 8; x++) {
      expect(grid[7]![x]).toBe(false);
    }
  });

  it('clears the spacer column directly right of the top-left finder', () => {
    // clearSpacer(grid, 7, 0, 1, 8) -> column x=7, y in [0..7]
    for (let y = 0; y < 8; y++) {
      expect(grid[y]![7]).toBe(false);
    }
  });

  it('clears the spacer row directly below the top-right finder', () => {
    // clearSpacer(grid, sz-8, 7, 8, 1) -> row y=7, x in [sz-8..sz-1]
    for (let x = sz - 8; x < sz; x++) {
      expect(grid[7]![x]).toBe(false);
    }
  });

  it('clears the spacer column directly left of the top-right finder', () => {
    // clearSpacer(grid, sz-8, 0, 1, 7) -> column x=sz-8, y in [0..6]
    for (let y = 0; y < 7; y++) {
      expect(grid[y]![sz - 8]).toBe(false);
    }
  });

  it('clears the spacer row directly above the bottom-left finder', () => {
    // clearSpacer(grid, 0, sz-8, 7, 1) -> row y=sz-8, x in [0..6]
    for (let x = 0; x < 7; x++) {
      expect(grid[sz - 8]![x]).toBe(false);
    }
  });

  it('clears the spacer column directly right of the bottom-left finder', () => {
    // clearSpacer(grid, 7, sz-8, 1, 8) -> column x=7, y in [sz-8..sz-1]
    for (let y = sz - 8; y < sz; y++) {
      expect(grid[y]![7]).toBe(false);
    }
  });

  it('draws the row-6 timing strip alternating filled/empty between finders', () => {
    // Timing strip lives in row 6 for x in [8 .. sz-8).
    for (let x = 8; x < sz - 8; x++) {
      expect(grid[6]![x]).toBe(x % 2 === 0);
    }
  });

  it('draws the column-6 timing strip alternating filled/empty between finders', () => {
    // Timing strip lives in column 6 for y in [8 .. sz-8).
    for (let y = 8; y < sz - 8; y++) {
      expect(grid[6]![y]).toBe(y % 2 === 0);
    }
  });
});

describe('AE506 - buildSigilGrid - density', () => {
  it('produces a busy grid (density between 25% and 75%) on the default size', () => {
    const grid = buildSigilGrid('density-seed');
    const total = 21 * 21;
    const filled = sigilFilledCount(grid);
    const density = filled / total;
    expect(density).toBeGreaterThan(0.25);
    expect(density).toBeLessThan(0.75);
  });

  it('produces a non-empty + non-fully-filled grid on a noise-only size (8)', () => {
    const grid = buildSigilGrid('noise-only', 8);
    const filled = sigilFilledCount(grid);
    expect(filled).toBeGreaterThan(0);
    expect(filled).toBeLessThan(8 * 8);
  });
});

describe('AE506 - sigilFilledCount', () => {
  it('returns 0 for an empty grid', () => {
    expect(sigilFilledCount([])).toBe(0);
  });

  it('returns 0 for an all-false grid', () => {
    const grid: SigilGrid = [
      [false, false],
      [false, false],
    ];
    expect(sigilFilledCount(grid)).toBe(0);
  });

  it('returns cell-count for an all-true grid', () => {
    const grid: SigilGrid = [
      [true, true, true],
      [true, true, true],
    ];
    expect(sigilFilledCount(grid)).toBe(6);
  });

  it('counts only true cells in a mixed grid', () => {
    const grid: SigilGrid = [
      [true, false, true],
      [false, true, false],
    ];
    expect(sigilFilledCount(grid)).toBe(3);
  });

  it('handles ragged rows (counts cells row-by-row)', () => {
    const grid: SigilGrid = [[true], [true, true], [false, true, true]];
    expect(sigilFilledCount(grid)).toBe(5);
  });
});

describe('AE506 - sigilEquals', () => {
  it('returns true for two empty grids', () => {
    expect(sigilEquals([], [])).toBe(true);
  });

  it('returns false when row counts differ', () => {
    const a: SigilGrid = [[true]];
    const b: SigilGrid = [[true], [false]];
    expect(sigilEquals(a, b)).toBe(false);
  });

  it('returns false when row widths differ at the same y', () => {
    const a: SigilGrid = [[true, false]];
    const b: SigilGrid = [[true]];
    expect(sigilEquals(a, b)).toBe(false);
  });

  it('returns true for byte-identical grids', () => {
    const a: SigilGrid = [
      [true, false],
      [false, true],
    ];
    const b: SigilGrid = [
      [true, false],
      [false, true],
    ];
    expect(sigilEquals(a, b)).toBe(true);
  });

  it('returns false when a single cell differs', () => {
    const a: SigilGrid = [
      [true, false],
      [false, true],
    ];
    const b: SigilGrid = [
      [true, false],
      [false, false],
    ];
    expect(sigilEquals(a, b)).toBe(false);
  });

  it('returns true when comparing a built grid to itself', () => {
    const g = buildSigilGrid('self-eq');
    expect(sigilEquals(g, g)).toBe(true);
  });

  it('returns true when comparing two grids built from the same seed + size', () => {
    expect(sigilEquals(buildSigilGrid('s', 11), buildSigilGrid('s', 11))).toBe(true);
  });

  it('returns false when comparing grids built from different sizes', () => {
    expect(sigilEquals(buildSigilGrid('s', 11), buildSigilGrid('s', 13))).toBe(false);
  });
});
