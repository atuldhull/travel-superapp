/** Vitest specs for AE395 destination-coords lookup. */
import { describe, expect, it } from 'vitest';
import {
  coordsForDestination,
  curatedCoordSlugs,
} from '../../src/components/aether/phase1/destination-coords';

describe('coordsForDestination (pure)', () => {
  it('returns coords for curated slugs', () => {
    const leh = coordsForDestination('leh');
    expect(leh).not.toBeNull();
    expect(leh?.lat).toBeCloseTo(34.15, 1);
    expect(leh?.lng).toBeCloseTo(77.58, 1);
  });

  it('case-insensitive', () => {
    expect(coordsForDestination('LEH')).toEqual(coordsForDestination('leh'));
    expect(coordsForDestination('Ladakh')).toEqual(coordsForDestination('leh'));
  });

  it('aliases share identity with the canonical slug', () => {
    expect(coordsForDestination('ladakh')).toBe(coordsForDestination('leh'));
    expect(coordsForDestination('spiti')).toBe(coordsForDestination('leh'));
    expect(coordsForDestination('anjuna')).toBe(coordsForDestination('goa'));
    expect(coordsForDestination('alleppey')).toBe(coordsForDestination('kerala'));
    expect(coordsForDestination('rajasthan')).toBe(coordsForDestination('jaipur'));
  });

  it('returns null for unknown slugs', () => {
    expect(coordsForDestination('paris')).toBeNull();
    expect(coordsForDestination('xyzzy')).toBeNull();
  });

  it('returns null on null / undefined / empty', () => {
    expect(coordsForDestination(null)).toBeNull();
    expect(coordsForDestination(undefined)).toBeNull();
    expect(coordsForDestination('')).toBeNull();
  });

  it('coords are within India lat/lng box', () => {
    for (const slug of curatedCoordSlugs()) {
      const c = coordsForDestination(slug);
      expect(c).not.toBeNull();
      expect(c?.lat).toBeGreaterThan(6); // southern tip
      expect(c?.lat).toBeLessThan(36); // northern Ladakh
      expect(c?.lng).toBeGreaterThan(68); // western Rajasthan
      expect(c?.lng).toBeLessThan(98); // eastern Arunachal
    }
  });
});

describe('curatedCoordSlugs (pure)', () => {
  it('returns the sorted curated slug list', () => {
    const slugs = curatedCoordSlugs();
    expect(slugs.length).toBeGreaterThanOrEqual(8);
    const sorted = [...slugs].sort();
    expect(slugs).toEqual(sorted);
  });

  it('every returned slug has coords', () => {
    for (const slug of curatedCoordSlugs()) {
      expect(coordsForDestination(slug)).not.toBeNull();
    }
  });
});
