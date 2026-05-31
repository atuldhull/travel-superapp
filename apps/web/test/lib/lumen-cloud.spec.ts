/** Vitest specs for AE398 Lumen photo cloud math. */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LUMEN_LAYOUT,
  clampRating,
  jitterZFor,
  layoutPhotoCloud,
  ratingToY,
  sortPhotosByTime,
  timeToX,
  type LumenPhotoLike,
} from '../../src/components/aether/phase2/lumen-cloud';

function photo(
  id: string,
  capturedAt: string | null,
  rating: number | null = null,
): LumenPhotoLike {
  return { id, capturedAt, rating, url: null };
}

describe('clampRating (pure)', () => {
  it('clamps to [0, 5]', () => {
    expect(clampRating(-1)).toBe(0);
    expect(clampRating(0)).toBe(0);
    expect(clampRating(2.5)).toBe(2.5);
    expect(clampRating(5)).toBe(5);
    expect(clampRating(7)).toBe(5);
  });
  it('null / undefined → 0', () => {
    expect(clampRating(null)).toBe(0);
    expect(clampRating(undefined)).toBe(0);
  });
  it('NaN / Infinity → 0', () => {
    expect(clampRating(Number.NaN)).toBe(0);
    expect(clampRating(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampRating(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe('timeToX (pure)', () => {
  const min = new Date('2026-06-01T00:00:00Z').getTime();
  const max = new Date('2026-06-08T00:00:00Z').getTime();

  it('null → 0 (centre)', () => {
    expect(timeToX(null, min, max, 18)).toBe(0);
    expect(timeToX('', min, max, 18)).toBe(0);
  });
  it('invalid date → 0', () => {
    expect(timeToX('not a date', min, max, 18)).toBe(0);
  });
  it('min → -axisLength/2', () => {
    expect(timeToX('2026-06-01T00:00:00Z', min, max, 18)).toBeCloseTo(-9, 9);
  });
  it('max → +axisLength/2', () => {
    expect(timeToX('2026-06-08T00:00:00Z', min, max, 18)).toBeCloseTo(9, 9);
  });
  it('midpoint → 0', () => {
    expect(timeToX('2026-06-04T12:00:00Z', min, max, 18)).toBeCloseTo(0, 9);
  });
  it('degenerate range (min == max) → 0 for everything', () => {
    expect(timeToX('2026-06-01T00:00:00Z', min, min, 18)).toBe(0);
  });
});

describe('ratingToY (pure)', () => {
  it('rating 0 → -axisLength/2 (bottom)', () => {
    expect(ratingToY(0, 8)).toBe(-4);
  });
  it('rating 5 → +axisLength/2 (top)', () => {
    expect(ratingToY(5, 8)).toBe(4);
  });
  it('rating 2.5 → 0 (centre)', () => {
    expect(ratingToY(2.5, 8)).toBe(0);
  });
  it('null / undefined / NaN → -axisLength/2', () => {
    expect(ratingToY(null, 8)).toBe(-4);
    expect(ratingToY(undefined, 8)).toBe(-4);
    expect(ratingToY(Number.NaN, 8)).toBe(-4);
  });
});

describe('jitterZFor (pure)', () => {
  it('is stable across calls', () => {
    expect(jitterZFor('abc', 2)).toBe(jitterZFor('abc', 2));
  });
  it('differs across ids', () => {
    expect(jitterZFor('abc', 2)).not.toBe(jitterZFor('xyz', 2));
  });
  it('stays within [-range/2, +range/2]', () => {
    for (let i = 0; i < 30; i++) {
      const z = jitterZFor(`id-${i}`, 1.6);
      expect(z).toBeGreaterThanOrEqual(-0.8);
      expect(z).toBeLessThanOrEqual(0.8);
    }
  });
});

describe('layoutPhotoCloud (pure)', () => {
  it('empty input → empty output', () => {
    expect(layoutPhotoCloud([])).toEqual([]);
  });

  it('single photo → x=0 (degenerate range)', () => {
    const out = layoutPhotoCloud([photo('a', '2026-06-01T00:00:00Z', 3)]);
    expect(out.length).toBe(1);
    expect(out[0]?.position[0]).toBe(0);
  });

  it('two photos at endpoints → +/- axisLength/2', () => {
    const out = layoutPhotoCloud([
      photo('a', '2026-06-01T00:00:00Z', 5),
      photo('z', '2026-06-08T00:00:00Z', 1),
    ]);
    expect(out[0]?.position[0]).toBeCloseTo(-DEFAULT_LUMEN_LAYOUT.axisLengthX / 2, 6);
    expect(out[1]?.position[0]).toBeCloseTo(DEFAULT_LUMEN_LAYOUT.axisLengthX / 2, 6);
  });

  it('rating drives y coordinate', () => {
    const out = layoutPhotoCloud([photo('top', '2026-06-01T00:00:00Z', 5)]);
    expect(out[0]?.position[1]).toBeCloseTo(DEFAULT_LUMEN_LAYOUT.axisLengthY / 2, 6);
  });

  it('null capturedAt collapses to x=0', () => {
    const out = layoutPhotoCloud([photo('null', null, 3)]);
    expect(out[0]?.position[0]).toBe(0);
  });

  it('every plane carries the layout config size', () => {
    const out = layoutPhotoCloud([photo('a', '2026-06-01T00:00:00Z', 3)]);
    expect(out[0]?.size).toBe(DEFAULT_LUMEN_LAYOUT.planeBaseSize);
  });
});

describe('sortPhotosByTime (pure)', () => {
  it('sorts ascending by capturedAt', () => {
    const sorted = sortPhotosByTime([
      photo('c', '2026-06-08T00:00:00Z'),
      photo('a', '2026-06-01T00:00:00Z'),
      photo('b', '2026-06-04T00:00:00Z'),
    ]);
    expect(sorted.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });
  it('null capturedAt sinks to the end', () => {
    const sorted = sortPhotosByTime([photo('null', null), photo('a', '2026-06-01T00:00:00Z')]);
    expect(sorted.map((p) => p.id)).toEqual(['a', 'null']);
  });
  it('preserves input order on ties (stable)', () => {
    const sorted = sortPhotosByTime([
      photo('a', '2026-06-01T00:00:00Z'),
      photo('b', '2026-06-01T00:00:00Z'),
    ]);
    expect(sorted.map((p) => p.id)).toEqual(['a', 'b']);
  });
});
