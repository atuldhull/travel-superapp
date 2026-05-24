/**
 * Property-based tests for `apps/api/src/common/geo/haversine.ts`
 * ([J2]). The four metric axioms + the bounded-by-circumference fact
 * are exhaustively checked over random WGS-84 points; the lat/lng
 * range guard is fuzzed against arbitrary numeric inputs.
 *
 * What this catches that example tests don't: a regression in the
 * trig (mis-ordered subtraction, wrong radius constant, wrong
 * coefficient on the `2R · asin`) often passes one or two cherry-
 * picked points then fails on the rest. Fuzzing forces 100+
 * combinations per property + shrinks failures to a minimum.
 */
import fc from 'fast-check';
import { ValidationError } from '@app/errors';
import {
  EARTH_RADIUS_METRES,
  assertValidCoordinates,
  haversineKm,
  haversineMeters,
  isInBbox,
  type LatLng,
} from '../src/common/geo/haversine';

/** WGS-84 valid lat/lng pair. */
const point: fc.Arbitrary<LatLng> = fc.record({
  lat: fc.double({ min: -90, max: 90, noNaN: true }),
  lng: fc.double({ min: -180, max: 180, noNaN: true }),
});

/** Max possible great-circle distance on a sphere of radius R. */
const MAX_DISTANCE_METRES = Math.PI * EARTH_RADIUS_METRES;

describe('haversineMeters — metric axioms', () => {
  it('M1: non-negative for every pair', () => {
    fc.assert(
      fc.property(point, point, (a, b) => {
        expect(haversineMeters(a, b)).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it('M2: identity — d(a,a) = 0 within FP epsilon', () => {
    fc.assert(
      fc.property(point, (a) => {
        // Floating-point can leave a residual on the order of 1e-9 m,
        // which is sub-nanometre — accept anything under 1 cm.
        expect(haversineMeters(a, a)).toBeLessThan(0.01);
      }),
    );
  });

  it('M3: symmetric — d(a,b) === d(b,a) within FP epsilon', () => {
    fc.assert(
      fc.property(point, point, (a, b) => {
        const ab = haversineMeters(a, b);
        const ba = haversineMeters(b, a);
        // Same calculation, same operands; the only diff is FP order.
        // Accept sub-millimetre delta.
        expect(Math.abs(ab - ba)).toBeLessThan(0.001);
      }),
    );
  });

  it('M4: triangle inequality — d(a,c) ≤ d(a,b) + d(b,c) (with FP slop)', () => {
    fc.assert(
      fc.property(point, point, point, (a, b, c) => {
        const ab = haversineMeters(a, b);
        const bc = haversineMeters(b, c);
        const ac = haversineMeters(a, c);
        // 1-metre tolerance on a 20 000-km bound — well within
        // float64's ~1e-9 relative precision.
        expect(ac).toBeLessThanOrEqual(ab + bc + 1);
      }),
    );
  });

  it('B1: bounded above by ~π · R (max great-circle distance)', () => {
    fc.assert(
      fc.property(point, point, (a, b) => {
        // Add a small absolute margin for asin-clamp behaviour at
        // antipodal corner cases.
        expect(haversineMeters(a, b)).toBeLessThanOrEqual(MAX_DISTANCE_METRES + 1);
      }),
    );
  });
});

describe('haversineKm — derivative consistency', () => {
  it('K1: haversineKm === haversineMeters / 1000 (exact)', () => {
    fc.assert(
      fc.property(point, point, (a, b) => {
        expect(haversineKm(a, b)).toBe(haversineMeters(a, b) / 1000);
      }),
    );
  });
});

describe('haversineMeters — known fixture (Paris ↔ NYC)', () => {
  // Sanity anchor: well-known great-circle distance ≈ 5837 km.
  // Catches a sign-flip / wrong-constant regression that the
  // axioms alone would still satisfy.
  const paris: LatLng = { lat: 48.8566, lng: 2.3522 };
  const nyc: LatLng = { lat: 40.7128, lng: -74.006 };

  it('Paris ↔ NYC ≈ 5837 km (±5 km)', () => {
    expect(haversineKm(paris, nyc)).toBeGreaterThan(5832);
    expect(haversineKm(paris, nyc)).toBeLessThan(5842);
  });
});

describe('assertValidCoordinates — fuzz', () => {
  it('accepts every WGS-84 valid point', () => {
    fc.assert(
      fc.property(point, ({ lat, lng }) => {
        expect(() => assertValidCoordinates(lat, lng)).not.toThrow();
      }),
    );
  });

  it('rejects every out-of-range latitude (|lat| > 90)', () => {
    const badLat = fc.oneof(
      fc.double({ min: -1e6, max: -90.0001, noNaN: true }),
      fc.double({ min: 90.0001, max: 1e6, noNaN: true }),
    );
    fc.assert(
      fc.property(badLat, fc.double({ min: -180, max: 180, noNaN: true }), (lat, lng) => {
        try {
          assertValidCoordinates(lat, lng);
          throw new Error('expected throw');
        } catch (err) {
          expect(err).toBeInstanceOf(ValidationError);
          expect((err as ValidationError).code).toBe('INVALID_COORDINATES');
        }
      }),
    );
  });

  it('rejects every out-of-range longitude (|lng| > 180)', () => {
    const badLng = fc.oneof(
      fc.double({ min: -1e6, max: -180.0001, noNaN: true }),
      fc.double({ min: 180.0001, max: 1e6, noNaN: true }),
    );
    fc.assert(
      fc.property(fc.double({ min: -90, max: 90, noNaN: true }), badLng, (lat, lng) => {
        try {
          assertValidCoordinates(lat, lng);
          throw new Error('expected throw');
        } catch (err) {
          expect(err).toBeInstanceOf(ValidationError);
          expect((err as ValidationError).code).toBe('INVALID_COORDINATES');
        }
      }),
    );
  });

  it('rejects NaN + ±Infinity on either axis', () => {
    const nonFinite = fc.constantFrom(NaN, Infinity, -Infinity);
    fc.assert(
      fc.property(nonFinite, fc.double({ min: -180, max: 180, noNaN: true }), (lat, lng) => {
        expect(() => assertValidCoordinates(lat, lng)).toThrow(ValidationError);
      }),
    );
    fc.assert(
      fc.property(fc.double({ min: -90, max: 90, noNaN: true }), nonFinite, (lat, lng) => {
        expect(() => assertValidCoordinates(lat, lng)).toThrow(ValidationError);
      }),
    );
  });
});

describe('isInBbox — set semantics', () => {
  /** A normalised non-wrapping bbox: min* ≤ max*. */
  const bbox = fc
    .record({
      a: fc.double({ min: -90, max: 90, noNaN: true }),
      b: fc.double({ min: -90, max: 90, noNaN: true }),
      c: fc.double({ min: -180, max: 180, noNaN: true }),
      d: fc.double({ min: -180, max: 180, noNaN: true }),
    })
    .map(({ a, b, c, d }) => ({
      minLat: Math.min(a, b),
      maxLat: Math.max(a, b),
      minLng: Math.min(c, d),
      maxLng: Math.max(c, d),
    }));

  it('B1: corner points are inside (boundary is closed)', () => {
    fc.assert(
      fc.property(bbox, (b) => {
        expect(isInBbox({ lat: b.minLat, lng: b.minLng }, b)).toBe(true);
        expect(isInBbox({ lat: b.maxLat, lng: b.maxLng }, b)).toBe(true);
      }),
    );
  });

  it('B2: points just outside any face are NOT inside', () => {
    fc.assert(
      fc.property(bbox, (b) => {
        // 1° step outside the lat range. Skip degenerate cases where
        // the bbox spans the full pole.
        if (b.maxLat < 89) {
          expect(isInBbox({ lat: b.maxLat + 1, lng: b.minLng }, b)).toBe(false);
        }
        if (b.minLat > -89) {
          expect(isInBbox({ lat: b.minLat - 1, lng: b.minLng }, b)).toBe(false);
        }
      }),
    );
  });
});
