/**
 * Vitest specs for AE269 buildDestinationTagline.
 */
import { describe, expect, it } from 'vitest';
import { buildDestinationTagline } from '../../src/components/aether/destinations/tagline-line';

describe('buildDestinationTagline', () => {
  it('all three segments', () => {
    expect(
      buildDestinationTagline({
        state: 'Ladakh',
        tagline: 'Cold high desert',
        inSeasonRange: 'Jun–Sep',
      }),
    ).toBe('Ladakh · Cold high desert · In season Jun–Sep');
  });

  it('state + tagline (no season)', () => {
    expect(buildDestinationTagline({ state: 'Kerala', tagline: 'Backwaters and rice' })).toBe(
      'Kerala · Backwaters and rice',
    );
  });

  it('state only', () => {
    expect(buildDestinationTagline({ state: 'Goa' })).toBe('Goa');
  });

  it('empty all → ""', () => {
    expect(buildDestinationTagline({})).toBe('');
  });

  it('whitespace-only fields treated as empty', () => {
    expect(buildDestinationTagline({ state: '   ', tagline: '\t  ', inSeasonRange: '\n' })).toBe(
      '',
    );
  });

  it('trims surviving fields', () => {
    expect(
      buildDestinationTagline({
        state: '  Ladakh  ',
        tagline: '  cold  ',
        inSeasonRange: '  Jun–Sep  ',
      }),
    ).toBe('Ladakh · cold · In season Jun–Sep');
  });

  it('null/undefined values dropped', () => {
    expect(
      buildDestinationTagline({ state: null, tagline: undefined, inSeasonRange: 'Year-round' }),
    ).toBe('In season Year-round');
  });
});
