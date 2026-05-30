/**
 * Vitest specs for AE246 destinationBySlug + destinationBySlugCi.
 */
import { describe, expect, it } from 'vitest';
import {
  destinationBySlug,
  destinationBySlugCi,
} from '../../src/components/aether/destinations/destination-by-slug';

const D = [
  { slug: 'leh', name: 'Leh' },
  { slug: 'jaipur', name: 'Jaipur' },
  { slug: 'alleppey', name: 'Alleppey' },
];

describe('destinationBySlug', () => {
  it('hit', () => {
    expect(destinationBySlug(D, 'jaipur')?.name).toBe('Jaipur');
  });
  it('miss → null', () => {
    expect(destinationBySlug(D, 'mumbai')).toBeNull();
  });
  it('empty → null', () => {
    expect(destinationBySlug(D, '')).toBeNull();
  });
  it('case-sensitive (mismatch)', () => {
    expect(destinationBySlug(D, 'LEH')).toBeNull();
  });
  it('empty list → null', () => {
    expect(destinationBySlug([], 'leh')).toBeNull();
  });
  it('trims input', () => {
    expect(destinationBySlug(D, '  leh  ')?.name).toBe('Leh');
  });
});

describe('destinationBySlugCi', () => {
  it('matches mixed case', () => {
    expect(destinationBySlugCi(D, 'LEH')?.name).toBe('Leh');
    expect(destinationBySlugCi(D, 'Jaipur')?.name).toBe('Jaipur');
  });
  it('miss → null', () => {
    expect(destinationBySlugCi(D, 'shanghai')).toBeNull();
  });
  it('empty → null', () => {
    expect(destinationBySlugCi(D, '')).toBeNull();
  });
  it('trims AND case-folds', () => {
    expect(destinationBySlugCi(D, '  LEH  ')?.name).toBe('Leh');
  });
});
