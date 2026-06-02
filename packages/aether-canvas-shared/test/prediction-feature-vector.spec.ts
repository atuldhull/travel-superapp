/**
 * AE585 — behavioural spec for `prediction-feature-vector` +
 * `predictable-surface`.
 *
 * Pins the time-of-day bucketing (incl. hostile hours), the trip-phase
 * derivation boundaries, the dwell sanitiser, the recency-rank helper,
 * and the navigable-surface guard — the feature contract the predictor +
 * the future MLP both read.
 */
import {
  NAVIGABLE_SURFACES,
  isNavigableSurface,
  recencyRank,
  safeDwellMs,
  timeOfDayBucketFromHour,
  tripPhaseFromDayIndex,
  type PredictableSurfaceId,
  type TimeOfDayBucket,
} from '../src';

describe('AE585 — timeOfDayBucketFromHour', () => {
  it('maps each band to its bucket', () => {
    const cases: Array<[number, TimeOfDayBucket]> = [
      [5, 'dawn'],
      [7, 'dawn'],
      [8, 'morning'],
      [11, 'morning'],
      [12, 'afternoon'],
      [16, 'afternoon'],
      [17, 'evening'],
      [20, 'evening'],
      [21, 'night'],
      [23, 'night'],
      [0, 'night'],
      [4, 'night'],
    ];
    for (const [hour, bucket] of cases) {
      expect(timeOfDayBucketFromHour(hour)).toBe(bucket);
    }
  });

  it('wraps negative + overflow hours into [0,24) without throwing', () => {
    expect(timeOfDayBucketFromHour(-1)).toBe('night'); // 23
    expect(timeOfDayBucketFromHour(24)).toBe('night'); // 0
    expect(timeOfDayBucketFromHour(25)).toBe('night'); // 1
    expect(timeOfDayBucketFromHour(32)).toBe('morning'); // 8
  });

  it('falls back to morning for non-finite input', () => {
    expect(timeOfDayBucketFromHour(Number.NaN)).toBe('morning');
    expect(timeOfDayBucketFromHour(Number.POSITIVE_INFINITY)).toBe('morning');
  });

  it('truncates fractional hours', () => {
    expect(timeOfDayBucketFromHour(8.9)).toBe('morning');
  });
});

describe('AE585 — tripPhaseFromDayIndex', () => {
  it('treats a null / absent active trip as planning', () => {
    expect(tripPhaseFromDayIndex(null, 4)).toBe('planning');
    expect(tripPhaseFromDayIndex(Number.NaN, 4)).toBe('planning');
  });

  it('walks the lifecycle across the day boundaries', () => {
    expect(tripPhaseFromDayIndex(-2, 4)).toBe('planning'); // well before
    expect(tripPhaseFromDayIndex(-1, 4)).toBe('pre-trip'); // day before
    expect(tripPhaseFromDayIndex(0, 4)).toBe('in-trip'); // first day
    expect(tripPhaseFromDayIndex(4, 4)).toBe('in-trip'); // last day
    expect(tripPhaseFromDayIndex(5, 4)).toBe('post-trip'); // after
  });

  it('sanitises a non-finite / negative lastDayIndex so day 0 stays in-trip', () => {
    // `dayIndex <= NaN` is always false, which would misclassify an active
    // day as post-trip; the fallback (last=0) keeps day 0 in-trip.
    expect(tripPhaseFromDayIndex(0, Number.NaN)).toBe('in-trip');
    expect(tripPhaseFromDayIndex(0, -5)).toBe('in-trip');
    expect(tripPhaseFromDayIndex(0, Number.NEGATIVE_INFINITY)).toBe('in-trip');
  });

  it('routes a fractional pre-start offset to pre-trip', () => {
    expect(tripPhaseFromDayIndex(-0.5, 4)).toBe('pre-trip');
  });
});

describe('AE585 — safeDwellMs', () => {
  it('passes finite positive readings through', () => {
    expect(safeDwellMs(1500)).toBe(1500);
  });
  it('floors zero / negative / non-finite to 0', () => {
    expect(safeDwellMs(0)).toBe(0);
    expect(safeDwellMs(-200)).toBe(0);
    expect(safeDwellMs(Number.NaN)).toBe(0);
    expect(safeDwellMs(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('AE585 — recencyRank', () => {
  const hist: PredictableSurfaceId[] = ['drift', 'atlas', 'compass']; // newest last

  it('ranks the newest entry 0 and counts backwards', () => {
    expect(recencyRank('compass', hist)).toBe(0);
    expect(recencyRank('atlas', hist)).toBe(1);
    expect(recencyRank('drift', hist)).toBe(2);
  });
  it('returns Infinity for a surface not in history', () => {
    expect(recencyRank('vault', hist)).toBe(Infinity);
  });
  it('returns the most-recent rank when a surface repeats', () => {
    expect(recencyRank('atlas', ['atlas', 'compass', 'atlas'])).toBe(0);
  });
  it('returns Infinity against empty history', () => {
    expect(recencyRank('atlas', [])).toBe(Infinity);
  });
});

describe('AE585 — navigable surfaces', () => {
  it('excludes the always-present pulse overlay', () => {
    expect(NAVIGABLE_SURFACES).not.toContain('pulse');
    expect(isNavigableSurface('pulse')).toBe(false);
  });
  it('accepts every real navigation target', () => {
    for (const s of NAVIGABLE_SURFACES) {
      expect(isNavigableSurface(s)).toBe(true);
    }
    expect(NAVIGABLE_SURFACES).toHaveLength(9);
  });
  it('rejects junk + is frozen', () => {
    expect(isNavigableSurface('nope')).toBe(false);
    expect(isNavigableSurface(null)).toBe(false);
    expect(isNavigableSurface(42)).toBe(false);
    expect(Object.isFrozen(NAVIGABLE_SURFACES)).toBe(true);
  });
});
