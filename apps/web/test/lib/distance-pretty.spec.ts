/**
 * Vitest specs for AE292 formatDistanceKm.
 */
import { describe, expect, it } from 'vitest';
import { formatDistanceKm } from '../../src/lib/distance-pretty';

describe('formatDistanceKm', () => {
  it('< 1km in meters', () => {
    expect(formatDistanceKm(0.5)).toBe('500 m');
  });
  it('1km boundary → "1.0 km"', () => {
    expect(formatDistanceKm(1)).toBe('1.0 km');
  });
  it('5.5km → "5.5 km"', () => {
    expect(formatDistanceKm(5.5)).toBe('5.5 km');
  });
  it('10km boundary → "10 km" (whole)', () => {
    expect(formatDistanceKm(10)).toBe('10 km');
  });
  it('124.7km → "125 km" (rounded whole)', () => {
    expect(formatDistanceKm(124.7)).toBe('125 km');
  });
  it('0 → "0 m"', () => {
    expect(formatDistanceKm(0)).toBe('0 m');
  });
  it('negative → "—"', () => {
    expect(formatDistanceKm(-5)).toBe('—');
  });
  it('NaN → "—"', () => {
    expect(formatDistanceKm(Number.NaN)).toBe('—');
  });
  it('rounds sub-1km to nearest meter', () => {
    expect(formatDistanceKm(0.4995)).toBe('500 m');
    expect(formatDistanceKm(0.499)).toBe('499 m');
  });
});
