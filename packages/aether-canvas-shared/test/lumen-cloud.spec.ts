/**
 * AE507 â€” Behavioural spec for `@app/aether-canvas-shared/src/lumen-cloud.ts`.
 *
 * Pins the pure helpers that drive Lumen's photo-cloud R3F scene so the
 * Phase 4 shared sub-package owns its own contract: rating clamp boundaries,
 * time-axis mapping with degenerate-range guard, rating-axis interpolation,
 * deterministic per-id z-jitter, full cloud layout assembly across empty /
 * singleton / multi photo lists, and stable null-sinking time sort.
 */
import {
  DEFAULT_LUMEN_LAYOUT,
  clampRating,
  jitterZFor,
  layoutPhotoCloud,
  ratingToY,
  sortPhotosByTime,
  timeToX,
  type LumenPhotoLike,
} from '../src';

describe('AE507 - DEFAULT_LUMEN_LAYOUT shape', () => {
  it('pins axisLengthX at 18 world units', () => {
    expect(DEFAULT_LUMEN_LAYOUT.axisLengthX).toBe(18);
  });

  it('pins axisLengthY at 8 world units', () => {
    expect(DEFAULT_LUMEN_LAYOUT.axisLengthY).toBe(8);
  });

  it('pins jitterZ at 1.6 world units', () => {
    expect(DEFAULT_LUMEN_LAYOUT.jitterZ).toBe(1.6);
  });

  it('pins planeBaseSize at 1.6 world units', () => {
    expect(DEFAULT_LUMEN_LAYOUT.planeBaseSize).toBe(1.6);
  });

  it('is frozen so callers cannot mutate the shared default', () => {
    expect(Object.isFrozen(DEFAULT_LUMEN_LAYOUT)).toBe(true);
  });
});

describe('AE507 - clampRating', () => {
  it('returns 0 for null', () => {
    expect(clampRating(null)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(clampRating(undefined)).toBe(0);
  });

  it('returns 0 for NaN', () => {
    expect(clampRating(Number.NaN)).toBe(0);
  });

  it('returns 0 for positive Infinity', () => {
    expect(clampRating(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('returns 0 for negative Infinity', () => {
    expect(clampRating(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it('clamps negative ratings to 0', () => {
    expect(clampRating(-3)).toBe(0);
  });

  it('clamps ratings above 5 to 5', () => {
    expect(clampRating(7)).toBe(5);
  });

  it('passes through 0 exactly (lower boundary)', () => {
    expect(clampRating(0)).toBe(0);
  });

  it('passes through 5 exactly (upper boundary)', () => {
    expect(clampRating(5)).toBe(5);
  });

  it('passes through fractional ratings inside the range', () => {
    expect(clampRating(2.5)).toBe(2.5);
  });
});

describe('AE507 - timeToX', () => {
  it('returns 0 for a null capture timestamp', () => {
    expect(timeToX(null, 0, 1000, 10)).toBe(0);
  });

  it('returns 0 for an empty-string capture timestamp', () => {
    expect(timeToX('', 0, 1000, 10)).toBe(0);
  });

  it('returns 0 for an unparseable timestamp (NaN getTime)', () => {
    expect(timeToX('not-a-date', 0, 1000, 10)).toBe(0);
  });

  it('returns 0 for a degenerate range where max <= min', () => {
    const t = new Date('2026-01-01T00:00:00Z').toISOString();
    expect(timeToX(t, 1000, 1000, 10)).toBe(0);
  });

  it('maps the earliest timestamp to -axisLength/2', () => {
    const minMs = new Date('2026-01-01T00:00:00Z').getTime();
    const maxMs = new Date('2026-01-02T00:00:00Z').getTime();
    expect(timeToX('2026-01-01T00:00:00Z', minMs, maxMs, 10)).toBe(-5);
  });

  it('maps the latest timestamp to +axisLength/2', () => {
    const minMs = new Date('2026-01-01T00:00:00Z').getTime();
    const maxMs = new Date('2026-01-02T00:00:00Z').getTime();
    expect(timeToX('2026-01-02T00:00:00Z', minMs, maxMs, 10)).toBe(5);
  });

  it('maps the midpoint timestamp to 0', () => {
    const minMs = new Date('2026-01-01T00:00:00Z').getTime();
    const maxMs = new Date('2026-01-03T00:00:00Z').getTime();
    expect(timeToX('2026-01-02T00:00:00Z', minMs, maxMs, 10)).toBe(0);
  });
});

describe('AE507 - ratingToY', () => {
  it('maps rating 5 to +axisLength/2 (top of cloud)', () => {
    expect(ratingToY(5, 8)).toBe(4);
  });

  it('maps rating 0 to -axisLength/2 (bottom of cloud)', () => {
    expect(ratingToY(0, 8)).toBe(-4);
  });

  it('maps null rating to -axisLength/2 (sinks unrated photos)', () => {
    expect(ratingToY(null, 8)).toBe(-4);
  });

  it('maps undefined rating to -axisLength/2', () => {
    expect(ratingToY(undefined, 8)).toBe(-4);
  });

  it('maps rating 2.5 to y=0 (linear midpoint)', () => {
    expect(ratingToY(2.5, 8)).toBe(0);
  });

  it('clamps out-of-range ratings before mapping', () => {
    expect(ratingToY(99, 8)).toBe(4);
    expect(ratingToY(-12, 8)).toBe(-4);
  });
});

describe('AE507 - jitterZFor', () => {
  it('returns the same offset for the same id (determinism)', () => {
    const a = jitterZFor('photo-001', 1.6);
    const b = jitterZFor('photo-001', 1.6);
    expect(a).toBe(b);
  });

  it('returns 0 for an empty id (hash collapses to 0)', () => {
    expect(jitterZFor('', 1.6)).toBe(-0.8);
  });

  it('produces an offset inside [-range/2, +range/2]', () => {
    const z = jitterZFor('photo-abc', 2);
    expect(z).toBeGreaterThanOrEqual(-1);
    expect(z).toBeLessThanOrEqual(1);
  });

  it('scales linearly with the range parameter', () => {
    const small = jitterZFor('photo-xyz', 1);
    const large = jitterZFor('photo-xyz', 2);
    expect(large).toBeCloseTo(small * 2, 10);
  });

  it('generally yields different offsets for different ids', () => {
    const a = jitterZFor('alpha', 1.6);
    const b = jitterZFor('beta', 1.6);
    expect(a).not.toBe(b);
  });
});

describe('AE507 - layoutPhotoCloud', () => {
  it('returns an empty array for an empty photo list', () => {
    expect(layoutPhotoCloud([])).toEqual([]);
  });

  it('places a single photo with valid timestamp at x=0 (degenerate range)', () => {
    const photos: ReadonlyArray<LumenPhotoLike> = [
      { id: 'p1', capturedAt: '2026-01-01T00:00:00Z', rating: 5, url: 'http://u/1' },
    ];
    const out = layoutPhotoCloud(photos);
    expect(out).toHaveLength(1);
    expect(out[0].position[0]).toBe(0);
  });

  it('collapses every photo to x=0 when all timestamps are null', () => {
    const photos: ReadonlyArray<LumenPhotoLike> = [
      { id: 'a', capturedAt: null, rating: 3, url: null },
      { id: 'b', capturedAt: null, rating: 4, url: null },
    ];
    const out = layoutPhotoCloud(photos);
    expect(out[0].position[0]).toBe(0);
    expect(out[1].position[0]).toBe(0);
  });

  it('maps the earliest photo to -axisLengthX/2 and the latest to +axisLengthX/2', () => {
    const photos: ReadonlyArray<LumenPhotoLike> = [
      { id: 'early', capturedAt: '2026-01-01T00:00:00Z', rating: 3, url: null },
      { id: 'late', capturedAt: '2026-01-05T00:00:00Z', rating: 3, url: null },
    ];
    const out = layoutPhotoCloud(photos);
    expect(out[0].position[0]).toBe(-9);
    expect(out[1].position[0]).toBe(9);
  });

  it('passes the photo url through verbatim (including null pending state)', () => {
    const photos: ReadonlyArray<LumenPhotoLike> = [
      { id: 'p1', capturedAt: null, rating: null, url: 'http://cdn/img-1.jpg' },
      { id: 'p2', capturedAt: null, rating: null, url: null },
    ];
    const out = layoutPhotoCloud(photos);
    expect(out[0].url).toBe('http://cdn/img-1.jpg');
    expect(out[1].url).toBe(null);
  });

  it('uses planeBaseSize from the supplied config for the size field', () => {
    const photos: ReadonlyArray<LumenPhotoLike> = [
      { id: 'p1', capturedAt: null, rating: null, url: null },
    ];
    const out = layoutPhotoCloud(photos, {
      axisLengthX: 10,
      axisLengthY: 4,
      jitterZ: 0,
      planeBaseSize: 3.25,
    });
    expect(out[0].size).toBe(3.25);
  });

  it('uses config.jitterZ when computing the z coordinate', () => {
    const photos: ReadonlyArray<LumenPhotoLike> = [
      { id: 'stable-id', capturedAt: null, rating: null, url: null },
    ];
    const big = layoutPhotoCloud(photos, {
      axisLengthX: 1,
      axisLengthY: 1,
      jitterZ: 4,
      planeBaseSize: 1,
    });
    const small = layoutPhotoCloud(photos, {
      axisLengthX: 1,
      axisLengthY: 1,
      jitterZ: 1,
      planeBaseSize: 1,
    });
    expect(big[0].position[2]).toBeCloseTo(small[0].position[2] * 4, 10);
  });

  it('preserves input order in the output array', () => {
    const photos: ReadonlyArray<LumenPhotoLike> = [
      { id: 'z', capturedAt: '2026-01-05T00:00:00Z', rating: 1, url: null },
      { id: 'a', capturedAt: '2026-01-01T00:00:00Z', rating: 5, url: null },
    ];
    const out = layoutPhotoCloud(photos);
    expect(out.map((p) => p.id)).toEqual(['z', 'a']);
  });

  it('skips invalid timestamps when computing the min/max range', () => {
    const photos: ReadonlyArray<LumenPhotoLike> = [
      { id: 'bad', capturedAt: 'not-a-date', rating: 3, url: null },
      { id: 'early', capturedAt: '2026-01-01T00:00:00Z', rating: 3, url: null },
      { id: 'late', capturedAt: '2026-01-05T00:00:00Z', rating: 3, url: null },
    ];
    const out = layoutPhotoCloud(photos);
    // bad timestamp collapses to 0 regardless of axis
    expect(out[0].position[0]).toBe(0);
    // early/late still span the full axis using only valid times
    expect(out[1].position[0]).toBe(-9);
    expect(out[2].position[0]).toBe(9);
  });
});

describe('AE507 - sortPhotosByTime', () => {
  it('returns an empty array for an empty input', () => {
    expect(sortPhotosByTime([])).toEqual([]);
  });

  it('orders photos by capturedAt ascending', () => {
    const photos: ReadonlyArray<LumenPhotoLike> = [
      { id: 'c', capturedAt: '2026-01-03T00:00:00Z', rating: null, url: null },
      { id: 'a', capturedAt: '2026-01-01T00:00:00Z', rating: null, url: null },
      { id: 'b', capturedAt: '2026-01-02T00:00:00Z', rating: null, url: null },
    ];
    expect(sortPhotosByTime(photos).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('sinks null timestamps to the end of the list', () => {
    const photos: ReadonlyArray<LumenPhotoLike> = [
      { id: 'n', capturedAt: null, rating: null, url: null },
      { id: 'a', capturedAt: '2026-01-01T00:00:00Z', rating: null, url: null },
    ];
    expect(sortPhotosByTime(photos).map((p) => p.id)).toEqual(['a', 'n']);
  });

  it('sinks unparseable timestamps to the end of the list', () => {
    const photos: ReadonlyArray<LumenPhotoLike> = [
      { id: 'bad', capturedAt: 'not-a-date', rating: null, url: null },
      { id: 'a', capturedAt: '2026-01-01T00:00:00Z', rating: null, url: null },
    ];
    expect(sortPhotosByTime(photos).map((p) => p.id)).toEqual(['a', 'bad']);
  });

  it('is stable on ties (preserves input order for equal timestamps)', () => {
    const photos: ReadonlyArray<LumenPhotoLike> = [
      { id: 'first', capturedAt: '2026-01-01T00:00:00Z', rating: null, url: null },
      { id: 'second', capturedAt: '2026-01-01T00:00:00Z', rating: null, url: null },
      { id: 'third', capturedAt: '2026-01-01T00:00:00Z', rating: null, url: null },
    ];
    expect(sortPhotosByTime(photos).map((p) => p.id)).toEqual(['first', 'second', 'third']);
  });

  it('does not mutate the input array', () => {
    const photos: ReadonlyArray<LumenPhotoLike> = [
      { id: 'c', capturedAt: '2026-01-03T00:00:00Z', rating: null, url: null },
      { id: 'a', capturedAt: '2026-01-01T00:00:00Z', rating: null, url: null },
    ];
    const before = photos.map((p) => p.id);
    sortPhotosByTime(photos);
    expect(photos.map((p) => p.id)).toEqual(before);
  });
});
