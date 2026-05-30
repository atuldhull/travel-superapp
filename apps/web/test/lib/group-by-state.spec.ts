/**
 * Vitest specs for AE287 groupByState.
 */
import { describe, expect, it } from 'vitest';
import { groupByState } from '../../src/components/aether/destinations/group-by-state';

const D = [
  { slug: 'leh', state: 'Ladakh' },
  { slug: 'jaipur', state: 'Rajasthan' },
  { slug: 'udaipur', state: 'Rajasthan' },
  { slug: 'alleppey', state: 'Kerala' },
  { slug: 'spiti', state: 'Himachal Pradesh' },
];

describe('groupByState', () => {
  it('groups by state name', () => {
    const got = groupByState(D);
    expect(got.get('Rajasthan')?.map((d) => d.slug)).toEqual(['jaipur', 'udaipur']);
    expect(got.get('Ladakh')?.map((d) => d.slug)).toEqual(['leh']);
  });

  it('preserves order within each bucket', () => {
    const got = groupByState([
      { slug: 'a', state: 'X' },
      { slug: 'b', state: 'X' },
      { slug: 'c', state: 'X' },
    ]);
    expect(got.get('X')?.map((d) => d.slug)).toEqual(['a', 'b', 'c']);
  });

  it('returns keys in alphabetical order', () => {
    const got = groupByState(D);
    expect([...got.keys()]).toEqual(['Himachal Pradesh', 'Kerala', 'Ladakh', 'Rajasthan']);
  });

  it('null state → "Other" bucket', () => {
    const got = groupByState([{ slug: 'x', state: null }]);
    expect(got.has('Other')).toBe(true);
  });

  it('empty state → "Other"', () => {
    const got = groupByState([{ slug: 'x', state: '' }]);
    expect(got.has('Other')).toBe(true);
  });

  it('whitespace-only state → "Other"', () => {
    const got = groupByState([{ slug: 'x', state: '   ' }]);
    expect(got.has('Other')).toBe(true);
  });

  it('empty input → empty Map', () => {
    expect(groupByState([]).size).toBe(0);
  });

  it('trims surviving state names', () => {
    const got = groupByState([{ slug: 'x', state: '  Kerala  ' }]);
    expect(got.has('Kerala')).toBe(true);
  });
});
