/**
 * AE586 — behavioural spec for `surface-predictor`'s `rankPredictions`.
 *
 * Pins the normalisation (scores sum to 1), the descending sort with a
 * stable id tie-break, the flooring of negative / non-finite weights, and
 * the "no signal → empty" contract that `prediction-confidence` relies on.
 */
import { rankPredictions, type PredictableSurfaceId } from '../src';

function mapOf(entries: Array<[PredictableSurfaceId, number]>): Map<PredictableSurfaceId, number> {
  return new Map(entries);
}

describe('AE586 — rankPredictions', () => {
  it('normalises weights into scores that sum to 1', () => {
    const out = rankPredictions(
      mapOf([
        ['atlas', 3],
        ['vault', 1],
      ]),
    );
    const sum = out.reduce((acc, p) => acc + p.score, 0);
    expect(sum).toBeCloseTo(1, 10);
    expect(out.find((p) => p.surface === 'atlas')?.score).toBeCloseTo(0.75, 10);
    expect(out.find((p) => p.surface === 'vault')?.score).toBeCloseTo(0.25, 10);
  });

  it('sorts by descending score', () => {
    const out = rankPredictions(
      mapOf([
        ['vault', 1],
        ['atlas', 3],
        ['echo', 2],
      ]),
    );
    expect(out.map((p) => p.surface)).toEqual(['atlas', 'echo', 'vault']);
  });

  it('breaks ties by surface id ascending for a total, stable order', () => {
    const out = rankPredictions(
      mapOf([
        ['vault', 2],
        ['atlas', 2],
      ]),
    );
    expect(out.map((p) => p.surface)).toEqual(['atlas', 'vault']);
    expect(out[0]?.score).toBeCloseTo(0.5, 10);
  });

  it('floors negative + non-finite weights to zero (drops them)', () => {
    const out = rankPredictions(
      mapOf([
        ['atlas', 5],
        ['vault', -3],
        ['echo', Number.NaN],
      ]),
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ surface: 'atlas', score: 1 });
  });

  it('returns an empty array when every weight is zero (no signal)', () => {
    expect(
      rankPredictions(
        mapOf([
          ['atlas', 0],
          ['vault', 0],
        ]),
      ),
    ).toEqual([]);
  });

  it('returns an empty array for an empty map', () => {
    expect(rankPredictions(new Map())).toEqual([]);
  });

  it('returns [] when the weight total overflows to Infinity (preserves sum-to-1)', () => {
    // Two finite-but-huge weights (a future MLP's logits) sum to Infinity;
    // w/total would be 0 for all, breaking the contract -> guard returns [].
    const out = rankPredictions(
      mapOf([
        ['atlas', Number.MAX_VALUE],
        ['vault', Number.MAX_VALUE],
      ]),
    );
    expect(out).toEqual([]);
  });
});
