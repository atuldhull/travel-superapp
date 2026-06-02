/**
 * AE588 — behavioural spec for `prediction-confidence`.
 *
 * Pins the "should we pre-warm?" gate: the absolute-score floor, the
 * margin-over-runner-up, the empty / single-prediction cases, custom
 * thresholds, and defensiveness against unsorted input.
 */
import { actionablePrediction, hasActionablePrediction, type SurfacePrediction } from '../src';

const clearWinner: SurfacePrediction[] = [
  { surface: 'atlas', score: 0.6 },
  { surface: 'vault', score: 0.2 },
  { surface: 'echo', score: 0.2 },
];

describe('AE588 — actionablePrediction', () => {
  it('returns null for an empty set', () => {
    expect(actionablePrediction([])).toBeNull();
  });

  it('returns the top pick when it clears both the floor and the margin', () => {
    expect(actionablePrediction(clearWinner)?.surface).toBe('atlas');
  });

  it('returns null when the top pick is below the absolute floor', () => {
    const weak: SurfacePrediction[] = [
      { surface: 'atlas', score: 0.3 },
      { surface: 'vault', score: 0.25 },
      { surface: 'echo', score: 0.2 },
    ];
    expect(actionablePrediction(weak)).toBeNull(); // 0.3 < 0.34
  });

  it('returns null on a near-tie even if the top clears the floor', () => {
    const tie: SurfacePrediction[] = [
      { surface: 'atlas', score: 0.4 },
      { surface: 'vault', score: 0.35 },
    ];
    expect(actionablePrediction(tie)).toBeNull(); // margin 0.05 < 0.12
  });

  it('treats a single prediction as having a vacuous margin', () => {
    expect(actionablePrediction([{ surface: 'atlas', score: 0.5 }])?.surface).toBe('atlas');
    expect(actionablePrediction([{ surface: 'atlas', score: 0.2 }])).toBeNull(); // < floor
  });

  it('honours custom thresholds', () => {
    const tie: SurfacePrediction[] = [
      { surface: 'atlas', score: 0.4 },
      { surface: 'vault', score: 0.35 },
    ];
    expect(actionablePrediction(tie, { minScore: 0.3, minMargin: 0.02 })?.surface).toBe('atlas');
  });

  it('is defensive against unsorted input', () => {
    const unsorted: SurfacePrediction[] = [
      { surface: 'vault', score: 0.2 },
      { surface: 'atlas', score: 0.6 },
      { surface: 'echo', score: 0.2 },
    ];
    expect(actionablePrediction(unsorted)?.surface).toBe('atlas');
  });

  it('treats the exact boundary as actionable (>= semantics)', () => {
    // top exactly 0.34 (== minScore) and margin exactly 0.12 (== minMargin).
    const out = actionablePrediction([
      { surface: 'atlas', score: 0.34 },
      { surface: 'vault', score: 0.22 },
    ]);
    expect(out?.surface).toBe('atlas');
  });

  it('rejects an exact top-tie (margin 0)', () => {
    expect(
      actionablePrediction([
        { surface: 'atlas', score: 0.5 },
        { surface: 'vault', score: 0.5 },
      ]),
    ).toBeNull();
  });

  it('tracks the runner-up across an ascending-order scan', () => {
    // secondScore must climb 0.1 -> 0.3 via the else-if branch.
    const out = actionablePrediction([
      { surface: 'echo', score: 0.1 },
      { surface: 'vault', score: 0.3 },
      { surface: 'atlas', score: 0.6 },
    ]);
    expect(out?.surface).toBe('atlas'); // margin 0.6-0.3 = 0.3
  });

  it('skips non-finite scores and is permutation-independent', () => {
    const a = actionablePrediction([
      { surface: 'mirror', score: Number.NaN },
      { surface: 'atlas', score: 0.5 },
    ]);
    const b = actionablePrediction([
      { surface: 'atlas', score: 0.5 },
      { surface: 'mirror', score: Number.NaN },
    ]);
    expect(a?.surface).toBe('atlas');
    expect(b?.surface).toBe('atlas');
    expect(actionablePrediction([{ surface: 'mirror', score: Number.NaN }])).toBeNull();
  });

  it('a lone prediction passes the margin vacuously even when minMargin > minScore', () => {
    expect(
      actionablePrediction([{ surface: 'atlas', score: 0.3 }], { minScore: 0.2, minMargin: 0.5 })
        ?.surface,
    ).toBe('atlas');
  });
});

describe('AE588 — hasActionablePrediction', () => {
  it('mirrors actionablePrediction as a boolean', () => {
    expect(hasActionablePrediction(clearWinner)).toBe(true);
    expect(hasActionablePrediction([])).toBe(false);
  });
});
