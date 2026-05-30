/**
 * Vitest specs for AE276 suggestedDuplicateName.
 */
import { describe, expect, it } from 'vitest';
import {
  SUGGESTED_NAME_MAX,
  suggestedDuplicateName,
} from '../../src/components/aether/journey/duplicate-suggested-name';

describe('suggestedDuplicateName', () => {
  it('first copy appends " (copy)"', () => {
    expect(suggestedDuplicateName('Leh winter trip')).toBe('Leh winter trip (copy)');
  });

  it('second copy bumps to " (copy 2)"', () => {
    expect(suggestedDuplicateName('Leh winter trip (copy)')).toBe('Leh winter trip (copy 2)');
  });

  it('third copy bumps to " (copy 3)"', () => {
    expect(suggestedDuplicateName('Leh winter trip (copy 2)')).toBe('Leh winter trip (copy 3)');
  });

  it('handles " (copy 99)" → 100', () => {
    expect(suggestedDuplicateName('A (copy 99)')).toBe('A (copy 100)');
  });

  it('empty input → "(copy)"', () => {
    expect(suggestedDuplicateName('')).toBe('(copy)');
  });

  it('whitespace-only input → "(copy)"', () => {
    expect(suggestedDuplicateName('   \n  ')).toBe('(copy)');
  });

  it('trims surviving title', () => {
    expect(suggestedDuplicateName('  Goa  ')).toBe('Goa (copy)');
  });

  it('case-insensitive "(COPY)" recognised', () => {
    expect(suggestedDuplicateName('Goa (COPY)')).toBe('Goa (copy 2)');
  });

  it('caps to SUGGESTED_NAME_MAX', () => {
    const long = 'x'.repeat(120);
    const got = suggestedDuplicateName(long);
    expect(got.length).toBeLessThanOrEqual(SUGGESTED_NAME_MAX);
  });

  it('SUGGESTED_NAME_MAX is the canonical 100', () => {
    expect(SUGGESTED_NAME_MAX).toBe(100);
  });
});
