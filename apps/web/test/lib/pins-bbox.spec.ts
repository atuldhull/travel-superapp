/**
 * Vitest specs for AE230 pinsBBox — Atlas pin bounding-box.
 */
import { describe, expect, it } from 'vitest';
import { pinsBBox } from '../../src/components/aether/atlas/pins-bbox';

describe('pinsBBox', () => {
  it('empty array → null', () => {
    expect(pinsBBox([])).toBeNull();
  });

  it('single pin → degenerate bbox (south=north, west=east)', () => {
    expect(pinsBBox([{ lat: 28.6139, lng: 77.209 }])).toEqual({
      south: 28.6139,
      north: 28.6139,
      west: 77.209,
      east: 77.209,
    });
  });

  it('two pins → tight bbox around both', () => {
    const got = pinsBBox([
      { lat: 28.6139, lng: 77.209 }, // Delhi
      { lat: 26.9124, lng: 75.7873 }, // Jaipur
    ]);
    expect(got).toEqual({
      south: 26.9124,
      north: 28.6139,
      west: 75.7873,
      east: 77.209,
    });
  });

  it('three pins (Leh + Jaipur + Alleppey) span India N-S + W-E', () => {
    const got = pinsBBox([
      { lat: 34.1526, lng: 77.5771 }, // Leh
      { lat: 26.9124, lng: 75.7873 }, // Jaipur
      { lat: 9.4981, lng: 76.3388 }, // Alleppey
    ]);
    expect(got?.south).toBeCloseTo(9.4981);
    expect(got?.north).toBeCloseTo(34.1526);
    expect(got?.west).toBeCloseTo(75.7873);
    expect(got?.east).toBeCloseTo(77.5771);
  });

  it('NaN lat → null (defensive)', () => {
    expect(
      pinsBBox([
        { lat: 28.6139, lng: 77.209 },
        { lat: Number.NaN, lng: 75 },
      ]),
    ).toBeNull();
  });

  it('Infinity lng → null', () => {
    expect(pinsBBox([{ lat: 28.6139, lng: Number.POSITIVE_INFINITY }])).toBeNull();
  });

  it('south <= north + west <= east invariants', () => {
    const got = pinsBBox([
      { lat: 0, lng: 0 },
      { lat: 10, lng: -10 },
      { lat: -5, lng: 5 },
    ]);
    expect(got?.south).toBeLessThanOrEqual(got?.north ?? Number.POSITIVE_INFINITY);
    expect(got?.west).toBeLessThanOrEqual(got?.east ?? Number.POSITIVE_INFINITY);
  });
});
