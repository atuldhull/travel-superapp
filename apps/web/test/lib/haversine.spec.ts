/**
 * Vitest specs for the AE170 haversine helpers (extracted from
 * atlas-canvas.tsx).
 *
 * Covers:
 *   • haversineKm sanity (Jaipur ↔ Mumbai ≈ 940 km ± 5 %)
 *   • zero distance for identical points
 *   • symmetry
 *   • nearestPin returns null for empty list
 *   • nearestPin picks the actually-closest pin
 *   • nearestPin distances are non-negative
 */
import { describe, expect, it } from 'vitest';
import { haversineKm, nearestPin } from '../../src/components/aether/atlas/haversine';

const JAIPUR = { lat: 26.9124, lng: 75.7873 };
const MUMBAI = { lat: 19.076, lng: 72.8777 };
const LEH = { lat: 34.1526, lng: 77.5771 };

describe('haversineKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineKm(JAIPUR, JAIPUR)).toBe(0);
  });

  it('Jaipur → Mumbai ≈ 940 km (±5%)', () => {
    // Real distance ≈ 935 km. Allow ±5% so curve / floating-point
    // wobble doesn't make this flaky.
    const km = haversineKm(JAIPUR, MUMBAI);
    expect(km).toBeGreaterThan(890);
    expect(km).toBeLessThan(990);
  });

  it('is symmetric', () => {
    expect(haversineKm(JAIPUR, LEH)).toBeCloseTo(haversineKm(LEH, JAIPUR), 6);
  });

  it('is non-negative for all India coords', () => {
    expect(haversineKm(LEH, MUMBAI)).toBeGreaterThan(0);
  });
});

// ─── AE232 — boundary geography cases ──────────────────────────────
describe('haversineKm — boundary cases (AE232)', () => {
  it('equator + 1 degree latitude ≈ 111 km', () => {
    const km = haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(km).toBeGreaterThan(110);
    expect(km).toBeLessThan(112);
  });

  it('antipodal pair ≈ half Earth circumference (~20015 km)', () => {
    const km = haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 180 });
    expect(km).toBeGreaterThan(20_000);
    expect(km).toBeLessThan(20_040);
  });

  it('North → South pole is the full meridian (~20015 km)', () => {
    const km = haversineKm({ lat: 90, lng: 0 }, { lat: -90, lng: 0 });
    expect(km).toBeGreaterThan(20_000);
    expect(km).toBeLessThan(20_040);
  });

  it('same lng, latitudinal 0.1°≈11.1km (10x check at 1°)', () => {
    const km = haversineKm({ lat: 0, lng: 50 }, { lat: 0.1, lng: 50 });
    expect(km).toBeGreaterThan(10.5);
    expect(km).toBeLessThan(11.5);
  });

  it('Mumbai → Delhi ≈ 1150 km (sanity, ±5%)', () => {
    const km = haversineKm({ lat: 19.076, lng: 72.8777 }, { lat: 28.6139, lng: 77.209 });
    expect(km).toBeGreaterThan(1090);
    expect(km).toBeLessThan(1210);
  });
});

describe('nearestPin', () => {
  const candidates = [JAIPUR, MUMBAI, LEH];

  it('returns null for an empty candidate list', () => {
    expect(nearestPin(JAIPUR, [])).toBeNull();
  });

  it('returns the closest pin', () => {
    // From Mumbai, the nearest of (Jaipur, Mumbai, Leh) is Mumbai itself.
    const got = nearestPin(MUMBAI, candidates);
    expect(got?.pin).toBe(MUMBAI);
    expect(got?.km).toBe(0);
  });

  it('returns the next-nearest when the user is far from all', () => {
    // From a point 100 km north of Jaipur, Jaipur should win over
    // Mumbai (much further) and Leh (way further).
    const here = { lat: 27.81, lng: 75.7873 };
    const got = nearestPin(here, candidates);
    expect(got?.pin).toBe(JAIPUR);
    expect(got?.km).toBeLessThan(120);
  });

  it('returned km is non-negative', () => {
    const got = nearestPin(LEH, candidates);
    expect(got?.km).toBeGreaterThanOrEqual(0);
  });
});
