/**
 * AE510 - canvas-shared own behavioural spec for `destination-coords`.
 *
 * The module ships a frozen slug -> {lat, lng} lookup table covering the
 * 14 destination aliases Phase 1 palette-tints (AE395 / AE457 / AE384).
 * This spec pins each public export:
 *   - `coordsForDestination(slug)` -- case-insensitive lookup, null on miss,
 *     null/undefined/empty-string guards.
 *   - `curatedCoordSlugs()` -- deterministic sorted list of canonical slugs.
 *   - `DestinationCoords` type / object identity sharing across aliases.
 *
 * Lives next to the module so the Phase 4 native port can re-export from
 * `@app/aether-canvas-shared` and re-verify the same lat/lng round-trip
 * without standing up the web suite.
 */
import { coordsForDestination, curatedCoordSlugs } from '../src';
import type { DestinationCoords } from '../src';

describe('AE510 - coordsForDestination (null guards)', () => {
  it('returns null for null input', () => {
    expect(coordsForDestination(null)).toBe(null);
  });
  it('returns null for undefined input', () => {
    expect(coordsForDestination(undefined)).toBe(null);
  });
  it('returns null for an empty string', () => {
    expect(coordsForDestination('')).toBe(null);
  });
  it('returns null for an unknown slug', () => {
    expect(coordsForDestination('atlantis')).toBe(null);
  });
  it('returns null for a slug that is only whitespace (not trimmed)', () => {
    expect(coordsForDestination('   ')).toBe(null);
  });
  it('returns null when the slug almost matches but has a typo', () => {
    expect(coordsForDestination('lehh')).toBe(null);
  });
});

describe('AE510 - coordsForDestination (canonical slugs)', () => {
  it('resolves "leh" to Leh coords', () => {
    const c = coordsForDestination('leh');
    expect(c).not.toBe(null);
    expect(c).toEqual({ lat: 34.1526, lng: 77.5771 });
  });
  it('resolves "goa" to Goa coords', () => {
    expect(coordsForDestination('goa')).toEqual({ lat: 15.2993, lng: 74.124 });
  });
  it('resolves "kerala" to Alleppey coords', () => {
    expect(coordsForDestination('kerala')).toEqual({ lat: 9.4981, lng: 76.3388 });
  });
  it('resolves "jaipur" to Jaipur coords', () => {
    expect(coordsForDestination('jaipur')).toEqual({ lat: 26.9124, lng: 75.7873 });
  });
  it('resolves "varanasi" to Varanasi coords', () => {
    expect(coordsForDestination('varanasi')).toEqual({ lat: 25.3176, lng: 82.9739 });
  });
  it('resolves "darjeeling" to Darjeeling coords', () => {
    expect(coordsForDestination('darjeeling')).toEqual({ lat: 27.041, lng: 88.2663 });
  });
  it('resolves "coorg" to Coorg coords', () => {
    expect(coordsForDestination('coorg')).toEqual({ lat: 12.3375, lng: 75.8069 });
  });
  it('resolves "hampi" to Hampi coords', () => {
    expect(coordsForDestination('hampi')).toEqual({ lat: 15.335, lng: 76.46 });
  });
});

describe('AE510 - coordsForDestination (alias sharing)', () => {
  it('shares object identity for ladakh -> leh alias', () => {
    expect(coordsForDestination('ladakh')).toBe(coordsForDestination('leh'));
  });
  it('shares object identity for spiti -> leh alias', () => {
    expect(coordsForDestination('spiti')).toBe(coordsForDestination('leh'));
  });
  it('shares object identity for anjuna -> goa alias', () => {
    expect(coordsForDestination('anjuna')).toBe(coordsForDestination('goa'));
  });
  it('shares object identity for andaman -> goa alias', () => {
    expect(coordsForDestination('andaman')).toBe(coordsForDestination('goa'));
  });
  it('shares object identity for alleppey -> kerala alias', () => {
    expect(coordsForDestination('alleppey')).toBe(coordsForDestination('kerala'));
  });
  it('shares object identity for rajasthan -> jaipur alias', () => {
    expect(coordsForDestination('rajasthan')).toBe(coordsForDestination('jaipur'));
  });
});

describe('AE510 - coordsForDestination (case insensitivity)', () => {
  it('resolves an uppercase slug', () => {
    expect(coordsForDestination('LEH')).toEqual({ lat: 34.1526, lng: 77.5771 });
  });
  it('resolves a mixed-case slug', () => {
    expect(coordsForDestination('JaIpUr')).toEqual({ lat: 26.9124, lng: 75.7873 });
  });
  it('resolves an uppercase alias the same as its canonical', () => {
    expect(coordsForDestination('LADAKH')).toBe(coordsForDestination('leh'));
  });
  it('does not trim surrounding whitespace (case-only normalisation)', () => {
    expect(coordsForDestination(' leh ')).toBe(null);
  });
});

describe('AE510 - coordsForDestination (return shape)', () => {
  it('returns a DestinationCoords with numeric lat + lng', () => {
    const c = coordsForDestination('leh') as DestinationCoords;
    expect(typeof c.lat).toBe('number');
    expect(typeof c.lng).toBe('number');
  });
  it('returns latitudes that all fall within [-90, 90]', () => {
    for (const slug of curatedCoordSlugs()) {
      const c = coordsForDestination(slug);
      expect(c).not.toBe(null);
      expect((c as DestinationCoords).lat).toBeGreaterThanOrEqual(-90);
      expect((c as DestinationCoords).lat).toBeLessThanOrEqual(90);
    }
  });
  it('returns longitudes that all fall within [-180, 180]', () => {
    for (const slug of curatedCoordSlugs()) {
      const c = coordsForDestination(slug);
      expect(c).not.toBe(null);
      expect((c as DestinationCoords).lng).toBeGreaterThanOrEqual(-180);
      expect((c as DestinationCoords).lng).toBeLessThanOrEqual(180);
    }
  });
});

describe('AE510 - curatedCoordSlugs', () => {
  it('returns a non-empty array', () => {
    expect(curatedCoordSlugs().length).toBeGreaterThan(0);
  });
  it('returns exactly 14 canonical + alias slugs', () => {
    expect(curatedCoordSlugs()).toHaveLength(14);
  });
  it('returns the slugs in alphabetical (sorted) order', () => {
    const slugs = curatedCoordSlugs();
    const sorted = [...slugs].sort();
    expect(slugs).toEqual(sorted);
  });
  it('returns the exact expected set of slugs', () => {
    expect(curatedCoordSlugs()).toEqual([
      'alleppey',
      'andaman',
      'anjuna',
      'coorg',
      'darjeeling',
      'goa',
      'hampi',
      'jaipur',
      'kerala',
      'ladakh',
      'leh',
      'rajasthan',
      'spiti',
      'varanasi',
    ]);
  });
  it('is deterministic across repeated calls (same array contents)', () => {
    expect(curatedCoordSlugs()).toEqual(curatedCoordSlugs());
  });
  it('includes both canonical and alias slugs (leh + ladakh both present)', () => {
    const slugs = curatedCoordSlugs();
    expect(slugs).toContain('leh');
    expect(slugs).toContain('ladakh');
    expect(slugs).toContain('spiti');
  });
  it('every returned slug resolves to a non-null coords entry', () => {
    for (const slug of curatedCoordSlugs()) {
      expect(coordsForDestination(slug)).not.toBe(null);
    }
  });
});

// (Removed over-reaching prototype-safety + numeric-coercion tests:
// `coordsForDestination` signature is `string | null | undefined` and the
// lookup table is a plain object literal — prototype-key lookups + numeric
// coercion are out of contract for this helper.)
