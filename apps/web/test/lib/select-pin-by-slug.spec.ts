/**
 * Vitest specs for AE244 selectPinBySlug + indexOfPinBySlug.
 */
import { describe, expect, it } from 'vitest';
import {
  indexOfPinBySlug,
  selectPinBySlug,
} from '../../src/components/aether/atlas/select-pin-by-slug';

const PINS = [
  { slug: 'leh', name: 'Leh' },
  { slug: 'jaipur', name: 'Jaipur' },
  { slug: 'alleppey', name: 'Alleppey' },
];

describe('selectPinBySlug', () => {
  it('returns the pin for a hit', () => {
    expect(selectPinBySlug(PINS, 'jaipur')?.name).toBe('Jaipur');
  });

  it('returns null for a miss', () => {
    expect(selectPinBySlug(PINS, 'mumbai')).toBeNull();
  });

  it('null for empty slug', () => {
    expect(selectPinBySlug(PINS, '')).toBeNull();
  });

  it('null for whitespace-only slug', () => {
    expect(selectPinBySlug(PINS, '   ')).toBeNull();
  });

  it('trims slug before matching', () => {
    expect(selectPinBySlug(PINS, '  leh  ')?.name).toBe('Leh');
  });

  it('null for empty pin list', () => {
    expect(selectPinBySlug([], 'leh')).toBeNull();
  });
});

describe('indexOfPinBySlug', () => {
  it('returns 0/1/2 for the three pins', () => {
    expect(indexOfPinBySlug(PINS, 'leh')).toBe(0);
    expect(indexOfPinBySlug(PINS, 'jaipur')).toBe(1);
    expect(indexOfPinBySlug(PINS, 'alleppey')).toBe(2);
  });

  it('returns -1 for a miss', () => {
    expect(indexOfPinBySlug(PINS, 'mumbai')).toBe(-1);
  });

  it('returns -1 for empty slug', () => {
    expect(indexOfPinBySlug(PINS, '')).toBe(-1);
  });

  it('returns -1 for empty list', () => {
    expect(indexOfPinBySlug([], 'leh')).toBe(-1);
  });
});
