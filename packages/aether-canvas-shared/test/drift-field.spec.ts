/**
 * AE535 - canvas-shared behavioural spec for the Drift ambient-field +
 * sun-disk math.
 *
 * Covers: determinism (same seed -> same cloud), bounds containment,
 * count handling (0 / negative / non-finite / fractional), the
 * Float32Array flattening shape, and sunDiskRotation wrapping +
 * monotonicity + non-finite guard.
 */
import {
  DEFAULT_DRIFT_BOUNDS,
  DEFAULT_DRIFT_MOTE_COUNT,
  DEFAULT_SUN_RADIANS_PER_SECOND,
  ambientFieldPositionArray,
  ambientFieldPositions,
  sunDiskRotation,
  type DriftBounds,
} from '../src';

describe('AE535 - constants', () => {
  it('DEFAULT_DRIFT_BOUNDS is a frozen positive-half-extent box', () => {
    expect(DEFAULT_DRIFT_BOUNDS.x).toBeGreaterThan(0);
    expect(DEFAULT_DRIFT_BOUNDS.y).toBeGreaterThan(0);
    expect(DEFAULT_DRIFT_BOUNDS.z).toBeGreaterThan(0);
    expect(Object.isFrozen(DEFAULT_DRIFT_BOUNDS)).toBe(true);
  });
  it('DEFAULT_DRIFT_MOTE_COUNT matches the web AE377 field (600)', () => {
    expect(DEFAULT_DRIFT_MOTE_COUNT).toBe(600);
  });
  it('DEFAULT_SUN_RADIANS_PER_SECOND is a slow positive rate', () => {
    expect(DEFAULT_SUN_RADIANS_PER_SECOND).toBeGreaterThan(0);
    expect(DEFAULT_SUN_RADIANS_PER_SECOND).toBeLessThan(1);
  });
});

describe('AE535 - ambientFieldPositions determinism', () => {
  it('returns the same cloud for the same (count, bounds, seed)', () => {
    const a = ambientFieldPositions(50);
    const b = ambientFieldPositions(50);
    expect(a).toEqual(b);
  });
  it('returns a different cloud for a different seed', () => {
    const a = ambientFieldPositions(50, DEFAULT_DRIFT_BOUNDS, 1);
    const b = ambientFieldPositions(50, DEFAULT_DRIFT_BOUNDS, 2);
    expect(a).not.toEqual(b);
  });
  it('is stable element-by-element across calls (first mote pinned)', () => {
    const first1 = ambientFieldPositions(10, DEFAULT_DRIFT_BOUNDS, 42)[0];
    const first2 = ambientFieldPositions(10, DEFAULT_DRIFT_BOUNDS, 42)[0];
    expect(first1).toEqual(first2);
  });
});

describe('AE535 - ambientFieldPositions count handling', () => {
  it('returns exactly count tuples', () => {
    expect(ambientFieldPositions(0)).toHaveLength(0);
    expect(ambientFieldPositions(1)).toHaveLength(1);
    expect(ambientFieldPositions(250)).toHaveLength(250);
  });
  it('returns [] for zero / negative / non-finite count', () => {
    expect(ambientFieldPositions(0)).toEqual([]);
    expect(ambientFieldPositions(-5)).toEqual([]);
    expect(ambientFieldPositions(Number.NaN)).toEqual([]);
    expect(ambientFieldPositions(Number.POSITIVE_INFINITY)).toEqual([]);
  });
  it('floors a fractional count', () => {
    expect(ambientFieldPositions(3.9)).toHaveLength(3);
  });
});

describe('AE535 - ambientFieldPositions bounds containment', () => {
  it('keeps every mote within +/- bounds on each axis', () => {
    const bounds: DriftBounds = { x: 6, y: 4, z: 5 };
    for (const [x, y, z] of ambientFieldPositions(500, bounds, 7)) {
      expect(Math.abs(x)).toBeLessThanOrEqual(bounds.x);
      expect(Math.abs(y)).toBeLessThanOrEqual(bounds.y);
      expect(Math.abs(z)).toBeLessThanOrEqual(bounds.z);
    }
  });
  it('respects a custom (asymmetric) bounds box', () => {
    const bounds: DriftBounds = { x: 1, y: 100, z: 0.5 };
    for (const [x, y, z] of ambientFieldPositions(200, bounds, 9)) {
      expect(Math.abs(x)).toBeLessThanOrEqual(1);
      expect(Math.abs(y)).toBeLessThanOrEqual(100);
      expect(Math.abs(z)).toBeLessThanOrEqual(0.5);
    }
  });
});

describe('AE535 - ambientFieldPositionArray', () => {
  it('returns a Float32Array of length count * 3', () => {
    const arr = ambientFieldPositionArray(100);
    expect(arr).toBeInstanceOf(Float32Array);
    expect(arr.length).toBe(300);
  });
  it('flattens the same coordinates as ambientFieldPositions', () => {
    const tuples = ambientFieldPositions(20, DEFAULT_DRIFT_BOUNDS, 123);
    const arr = ambientFieldPositionArray(20, DEFAULT_DRIFT_BOUNDS, 123);
    for (let i = 0; i < tuples.length; i += 1) {
      const t = tuples[i];
      if (t === undefined) continue;
      // Float32 rounds the float64 source — compare with tolerance.
      expect(arr[i * 3]).toBeCloseTo(t[0], 4);
      expect(arr[i * 3 + 1]).toBeCloseTo(t[1], 4);
      expect(arr[i * 3 + 2]).toBeCloseTo(t[2], 4);
    }
  });
  it('returns an empty Float32Array for zero count', () => {
    expect(ambientFieldPositionArray(0).length).toBe(0);
  });
});

describe('AE535 - sunDiskRotation', () => {
  it('is 0 at t=0', () => {
    expect(sunDiskRotation(0)).toBe(0);
  });
  it('grows with time within the first period', () => {
    const a = sunDiskRotation(1000);
    const b = sunDiskRotation(2000);
    expect(b).toBeGreaterThan(a);
  });
  it('wraps into [0, 2pi)', () => {
    for (const t of [0, 1000, 25_000, 50_000, 123_456, 1_000_000]) {
      const r = sunDiskRotation(t);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(2 * Math.PI);
    }
  });
  it('completes one turn over the default period (~50s)', () => {
    // At exactly the period the wrapped angle returns near 0.
    const periodMs = ((2 * Math.PI) / DEFAULT_SUN_RADIANS_PER_SECOND) * 1000;
    expect(sunDiskRotation(periodMs)).toBeCloseTo(0, 4);
  });
  it('honours a custom radiansPerSecond', () => {
    // pi rad/s -> at t=500ms the angle is pi/2.
    expect(sunDiskRotation(500, Math.PI)).toBeCloseTo(Math.PI / 2, 5);
  });
  it('returns 0 for non-finite time', () => {
    expect(sunDiskRotation(Number.NaN)).toBe(0);
    expect(sunDiskRotation(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
