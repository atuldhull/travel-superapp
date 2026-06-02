/**
 * AE587 — behavioural spec for `heuristic-surface-predictor`.
 *
 * Pins the baseline predictor's behaviour: cold-start fallback to
 * time+trip bias, transition-prior dominance when a current surface is
 * known, the recency penalty that suppresses the just-visited surface,
 * determinism, normalisation, the never-predict-pulse invariant, and
 * config overrides.
 */
import {
  NAVIGABLE_SURFACES,
  createHeuristicSurfacePredictor,
  recencyPenalty,
  type PredictableSurfaceId,
  type PredictionFeatureVector,
  type TimeOfDayBucket,
  type TripPhase,
} from '../src';

const ALL_TIME: TimeOfDayBucket[] = ['dawn', 'morning', 'afternoon', 'evening', 'night'];
const ALL_TRIP: TripPhase[] = ['planning', 'pre-trip', 'in-trip', 'post-trip'];

function fv(partial: Partial<PredictionFeatureVector> = {}): PredictionFeatureVector {
  return {
    currentSurface: null,
    recentSurfaces: [],
    dwellMsOnCurrent: 0,
    timeOfDay: 'morning' as TimeOfDayBucket,
    tripPhase: 'planning' as TripPhase,
    dayOfTripIndex: null,
    ...partial,
  };
}

describe('AE587 — recencyPenalty', () => {
  it('suppresses the most-recent hardest and relaxes with distance', () => {
    expect(recencyPenalty(0, 0.15, 0.25)).toBeCloseTo(0.15, 10);
    expect(recencyPenalty(1, 0.15, 0.25)).toBeCloseTo(0.4, 10);
    expect(recencyPenalty(2, 0.15, 0.25)).toBeCloseTo(0.65, 10);
  });
  it('caps at 1 and applies no penalty to never-visited (Infinity)', () => {
    expect(recencyPenalty(5, 0.15, 0.25)).toBe(1);
    expect(recencyPenalty(Infinity, 0.15, 0.25)).toBe(1);
  });
});

describe('AE587 — createHeuristicSurfacePredictor', () => {
  const predictor = createHeuristicSurfacePredictor();

  it('cold start (no current surface) leans on time + trip bias', () => {
    const out = predictor.predict(fv({ timeOfDay: 'morning', tripPhase: 'planning' }));
    expect(out.length).toBeGreaterThan(0);
    // morning + planning both favour Atlas heavily.
    expect(out[0]?.surface).toBe('atlas');
  });

  it('uses the transition prior when a current surface is known', () => {
    // From Lumen, in the evening, post-trip: Echo wins on all three signals.
    const out = predictor.predict(
      fv({ currentSurface: 'lumen', timeOfDay: 'evening', tripPhase: 'post-trip' }),
    );
    expect(out[0]?.surface).toBe('echo');
  });

  it('recency-penalises the current surface so it is never the top pick', () => {
    // Atlas is the current surface and otherwise strongly favoured; the
    // penalty must push Vault (its top transition target) ahead of it.
    const out = predictor.predict(
      fv({
        currentSurface: 'atlas',
        recentSurfaces: ['compass'],
        timeOfDay: 'morning',
        tripPhase: 'planning',
      }),
    );
    expect(out[0]?.surface).toBe('vault');
    const atlas = out.find((p) => p.surface === 'atlas');
    const compass = out.find((p) => p.surface === 'compass');
    // The just-left current (atlas, rank 0) is suppressed below the
    // older recent (compass, rank 1).
    expect(atlas?.score ?? 0).toBeLessThan(compass?.score ?? 0);
  });

  it('never predicts the pulse overlay', () => {
    const out = predictor.predict(fv({ currentSurface: 'drift' }));
    expect(out.some((p) => p.surface === 'pulse')).toBe(false);
  });

  it('emits normalised scores that sum to 1', () => {
    const out = predictor.predict(fv({ currentSurface: 'drift', timeOfDay: 'night' }));
    const sum = out.reduce((acc, p) => acc + p.score, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('is deterministic for the same feature vector', () => {
    const v = fv({ currentSurface: 'compass', timeOfDay: 'afternoon', tripPhase: 'in-trip' });
    expect(predictor.predict(v)).toEqual(predictor.predict(v));
  });

  it('honours a candidate-set override', () => {
    const restricted = createHeuristicSurfacePredictor({
      candidates: ['atlas', 'vault'] as PredictableSurfaceId[],
    });
    const out = restricted.predict(fv({ currentSurface: 'drift' }));
    for (const p of out) {
      expect(['atlas', 'vault']).toContain(p.surface);
    }
  });

  it('honours a blend-weight override (zeroing the prior = cold-start shape)', () => {
    const noPrior = createHeuristicSurfacePredictor({ priorWeight: 0 });
    const withCurrent = noPrior.predict(fv({ currentSurface: 'lumen', timeOfDay: 'morning' }));
    const coldStart = noPrior.predict(fv({ currentSurface: null, timeOfDay: 'morning' }));
    // With the prior zeroed, having a current surface only changes the
    // result via the recency penalty on that one surface — the top pick
    // (driven by time+trip) is identical.
    expect(withCurrent[0]?.surface).toBe(coldStart[0]?.surface);
  });
});

describe('AE590 — predictor hardening (adversarial-review fixes)', () => {
  const predictor = createHeuristicSurfacePredictor();

  it('every navigable surface is predictable in at least one state (no dead candidate)', () => {
    // Brute-force the {null + 9 froms} × 5 time × 4 trip state space and
    // assert every NAVIGABLE_SURFACES id appears in at least one ranking.
    // Guards the class of bug where `mirror` was a candidate with zero
    // inbound bias and could never be ranked.
    const reachable = new Set<string>();
    const froms: Array<PredictableSurfaceId | null> = [null, ...NAVIGABLE_SURFACES];
    for (const from of froms) {
      for (const t of ALL_TIME) {
        for (const phase of ALL_TRIP) {
          for (const p of predictor.predict(
            fv({ currentSurface: from, timeOfDay: t, tripPhase: phase }),
          )) {
            reachable.add(p.surface);
          }
        }
      }
    }
    for (const s of NAVIGABLE_SURFACES) {
      expect(reachable.has(s)).toBe(true);
    }
  });

  it('pins the cold-start morning/planning normalised scores (catches a blend-weight regression)', () => {
    // base: atlas 0.6*3+0.4*3=3.0, vault 0.6*2+0.4*1=1.6, compass 0.4*2=0.8,
    // drift 0.6*1=0.6, echo 0.6*1=0.6 -> sum 6.6.
    const out = predictor.predict(fv({ timeOfDay: 'morning', tripPhase: 'planning' }));
    const score = (s: string): number => out.find((p) => p.surface === s)?.score ?? 0;
    expect(score('atlas')).toBeCloseTo(3.0 / 6.6, 6);
    expect(score('vault')).toBeCloseTo(1.6 / 6.6, 6);
    expect(score('compass')).toBeCloseTo(0.8 / 6.6, 6);
  });

  it('the transition prior drives the top only at the default prior-dominant weights', () => {
    // From lumen the prior points at echo(4); time(afternoon)+trip(in-trip)
    // both favour compass. At defaults the prior wins (echo); zero the prior
    // and time+trip decide (compass) -> pins the weight ordering.
    const v = fv({ currentSurface: 'lumen', timeOfDay: 'afternoon', tripPhase: 'in-trip' });
    expect(predictor.predict(v)[0]?.surface).toBe('echo');
    const noPrior = createHeuristicSurfacePredictor({ priorWeight: 0 });
    expect(noPrior.predict(v)[0]?.surface).toBe('compass');
  });

  it('actually applies the recency penalty inside predict() (not just in the helper)', () => {
    // atlas is the just-visited surface; with the penalty ON its score must
    // be strictly lower than with the penalty OFF (recencyFloor:1).
    const v = fv({
      currentSurface: 'drift',
      recentSurfaces: ['atlas'],
      timeOfDay: 'morning',
      tripPhase: 'planning',
    });
    const on = predictor.predict(v).find((p) => p.surface === 'atlas')?.score ?? 0;
    const off =
      createHeuristicSurfacePredictor({ recencyFloor: 1 })
        .predict(v)
        .find((p) => p.surface === 'atlas')?.score ?? 0;
    expect(on).toBeLessThan(off);
  });

  it('does not double-count recency when history already ends in the current surface', () => {
    // Both vectors should resolve to the same effective history, so compass
    // (true rank 1) gets the same penalty either way.
    const withDup = predictor.predict(
      fv({
        currentSurface: 'atlas',
        recentSurfaces: ['drift', 'compass', 'atlas'],
        timeOfDay: 'morning',
        tripPhase: 'planning',
      }),
    );
    const withoutDup = predictor.predict(
      fv({
        currentSurface: 'atlas',
        recentSurfaces: ['drift', 'compass'],
        timeOfDay: 'morning',
        tripPhase: 'planning',
      }),
    );
    const c1 = withDup.find((p) => p.surface === 'compass')?.score ?? -1;
    const c2 = withoutDup.find((p) => p.surface === 'compass')?.score ?? -2;
    expect(c1).toBeCloseTo(c2, 10);
  });

  it('ignores dwellMsOnCurrent + dayOfTripIndex (reserved for the MLP)', () => {
    const base = fv({ currentSurface: 'atlas', timeOfDay: 'evening', tripPhase: 'in-trip' });
    const a = predictor.predict({ ...base, dwellMsOnCurrent: 0, dayOfTripIndex: null });
    const b = predictor.predict({ ...base, dwellMsOnCurrent: 999999, dayOfTripIndex: 3 });
    const c = predictor.predict({ ...base, dwellMsOnCurrent: -5, dayOfTripIndex: Number.NaN });
    expect(a).toEqual(b);
    expect(a).toEqual(c);
  });

  it('returns [] from predict() when no candidate has any signal', () => {
    // mirror only has a night bias; in morning/planning it has zero signal.
    const onlyMirror = createHeuristicSurfacePredictor({
      candidates: ['mirror'] as PredictableSurfaceId[],
    });
    expect(onlyMirror.predict(fv({ timeOfDay: 'morning', tripPhase: 'planning' }))).toEqual([]);
  });

  it('tolerates an out-of-union timeOfDay/tripPhase (widened telemetry) without throwing', () => {
    const out = predictor.predict(
      fv({
        currentSurface: 'drift',
        timeOfDay: 'zzz' as TimeOfDayBucket,
        tripPhase: 'qqq' as TripPhase,
      }),
    );
    // The transition prior from drift still provides signal -> non-empty, no throw.
    expect(out.length).toBeGreaterThan(0);
  });

  it('recencyPenalty clamps to [0,1] and treats a bad config as no-penalty', () => {
    expect(recencyPenalty(0, -0.5, 0.25)).toBe(0); // negative -> clamped to 0
    expect(recencyPenalty(0, Number.NaN, 0.25)).toBe(1); // NaN config -> no penalty
    expect(recencyPenalty(0, 0.15, Number.POSITIVE_INFINITY)).toBe(1); // Inf -> no penalty
    expect(recencyPenalty(10, 0.15, 0.25)).toBe(1); // caps at 1
  });
});
