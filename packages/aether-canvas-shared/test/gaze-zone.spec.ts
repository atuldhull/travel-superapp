/**
 * AE592 — behavioural spec for `gaze-zone`.
 *
 * Pins the 3×3 bucketing of every cell, the clamp on out-of-range +
 * non-finite coordinates, and the confidence gate on `gazeZoneOf`.
 */
import { gazeZone, gazeZoneOf, type GazePoint, type GazeZone } from '../src';

describe('AE592 — gazeZone', () => {
  it('maps each of the nine cells', () => {
    const cases: Array<[number, number, GazeZone]> = [
      [0.1, 0.1, 'top-left'],
      [0.5, 0.1, 'top'],
      [0.9, 0.1, 'top-right'],
      [0.1, 0.5, 'left'],
      [0.5, 0.5, 'center'],
      [0.9, 0.5, 'right'],
      [0.1, 0.9, 'bottom-left'],
      [0.5, 0.9, 'bottom'],
      [0.9, 0.9, 'bottom-right'],
    ];
    for (const [x, y, zone] of cases) {
      expect(gazeZone(x, y)).toBe(zone);
    }
  });

  it('clamps out-of-range coordinates into the grid', () => {
    expect(gazeZone(1.5, -0.5)).toBe('top-right'); // x->1 (col2), y->0 (row0)
    expect(gazeZone(1, 1)).toBe('bottom-right');
  });

  it('lands a non-finite axis in the centre third', () => {
    expect(gazeZone(Number.NaN, Number.NaN)).toBe('center');
    expect(gazeZone(0.1, Number.NaN)).toBe('left'); // x col0, y centre row
  });

  it('places the exact third seams in the upper bucket (strict <)', () => {
    expect(gazeZone(1 / 3, 0.5)).toBe('center'); // x == 1/3 -> col1, not 'left'
    expect(gazeZone(2 / 3, 0.5)).toBe('right'); // x == 2/3 -> col2, not 'center'
  });
});

describe('AE592 — gazeZoneOf', () => {
  const gaze = (over: Partial<GazePoint> = {}): GazePoint => ({
    x: 0.9,
    y: 0.9,
    confidence: 0.9,
    capturedAt: 0,
    ...over,
  });
  it('returns the zone for a confident gaze', () => {
    expect(gazeZoneOf(gaze())).toBe('bottom-right');
  });
  it('returns null for a null or low-confidence gaze', () => {
    expect(gazeZoneOf(null)).toBeNull();
    expect(gazeZoneOf(gaze({ confidence: 0.2 }))).toBeNull();
  });
});
