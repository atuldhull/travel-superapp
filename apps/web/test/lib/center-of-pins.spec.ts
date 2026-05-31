/**
 * Vitest specs for AE302 centerOfPins.
 */
import { describe, expect, it } from 'vitest';
import { centerOfPins } from '../../src/components/aether/atlas/center-of-pins';

describe('centerOfPins', () => {
  it('empty array → null', () => {
    expect(centerOfPins([])).toBeNull();
  });

  it('single pin → that pin', () => {
    expect(centerOfPins([{ lat: 28.6139, lng: 77.209 }])).toEqual({
      lat: 28.6139,
      lng: 77.209,
    });
  });

  it('two opposite pins → midpoint', () => {
    const got = centerOfPins([
      { lat: 0, lng: 0 },
      { lat: 10, lng: 20 },
    ]);
    expect(got).toEqual({ lat: 5, lng: 10 });
  });

  it("uses bbox midpoint (NOT centroid) so outliers don't drag", () => {
    // 9 pins clustered + 1 far outlier → bbox midpoint sits ~halfway
    // to the outlier, NOT close to the cluster average.
    const pins = [
      { lat: 0, lng: 0 },
      { lat: 0.1, lng: 0.1 },
      { lat: 0.1, lng: -0.1 },
      { lat: -0.1, lng: 0.1 },
      { lat: 0.05, lng: 0.05 },
      { lat: 0.05, lng: -0.05 },
      { lat: -0.05, lng: 0.05 },
      { lat: -0.05, lng: -0.05 },
      { lat: 0, lng: 0.05 },
      { lat: 100, lng: 100 }, // outlier
    ];
    const got = centerOfPins(pins);
    expect(got?.lat).toBeCloseTo(50.0, 1); // bbox midpoint = (−0.1 + 100)/2 ≈ 49.95
    expect(got?.lng).toBeCloseTo(50.0, 1);
  });

  it('NaN lat poisons → null (via pinsBBox guard)', () => {
    expect(
      centerOfPins([
        { lat: 0, lng: 0 },
        { lat: Number.NaN, lng: 1 },
      ]),
    ).toBeNull();
  });

  it('India bbox center is within India bounds', () => {
    const got = centerOfPins([
      { lat: 34.1526, lng: 77.5771 }, // Leh
      { lat: 9.4981, lng: 76.3388 }, // Alleppey
    ]);
    expect(got?.lat).toBeGreaterThan(8);
    expect(got?.lat).toBeLessThan(35);
    expect(got?.lng).toBeGreaterThan(75);
    expect(got?.lng).toBeLessThan(78);
  });
});
