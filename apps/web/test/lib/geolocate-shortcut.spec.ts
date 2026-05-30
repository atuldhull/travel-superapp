/**
 * Vitest specs for the AE199 Atlas `g` geolocate shortcut guard.
 */
import { describe, expect, it } from 'vitest';
import { shouldGeolocateOnG } from '../../src/components/aether/atlas/geolocate-shortcut';

describe('shouldGeolocateOnG', () => {
  it('returns true for "g" when focus is on the document body', () => {
    expect(shouldGeolocateOnG('g', { tagName: 'BODY' })).toBe(true);
  });

  it('returns false for non-g keys (case-sensitive)', () => {
    for (const key of ['G', 'h', '', '/', 'Enter', 'Escape']) {
      expect(shouldGeolocateOnG(key, { tagName: 'BODY' })).toBe(false);
    }
  });

  it('returns false when focus is in INPUT/TEXTAREA/SELECT', () => {
    expect(shouldGeolocateOnG('g', { tagName: 'INPUT' })).toBe(false);
    expect(shouldGeolocateOnG('g', { tagName: 'TEXTAREA' })).toBe(false);
    expect(shouldGeolocateOnG('g', { tagName: 'SELECT' })).toBe(false);
  });

  it('handles missing target safely', () => {
    expect(shouldGeolocateOnG('g', null)).toBe(true);
    expect(shouldGeolocateOnG('g', undefined)).toBe(true);
    expect(shouldGeolocateOnG('g', {})).toBe(true);
  });
});
