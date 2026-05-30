/**
 * Vitest specs for AE210 filterPins — Atlas text + season filter
 * combinator.
 */
import { describe, expect, it } from 'vitest';
import { filterPins } from '../../src/components/aether/atlas/filter-pins';

const PINS = [
  { slug: 'leh', name: 'Leh', state: 'Ladakh', tagline: 'Cold high desert' },
  { slug: 'jaipur', name: 'Jaipur', state: 'Rajasthan', tagline: 'The pink city' },
  { slug: 'alleppey', name: 'Alleppey', state: 'Kerala', tagline: 'Backwaters and rice' },
  { slug: 'varanasi', name: 'Varanasi', state: 'Uttar Pradesh', tagline: 'Ghats at dawn' },
];

const NEVER_IN_SEASON = (): boolean => false;
const ALWAYS_IN_SEASON = (): boolean => true;
const ONLY_KERALA = (slug: string): boolean => slug === 'alleppey';

describe('filterPins', () => {
  it('returns all pins for empty query + season off', () => {
    const got = filterPins(PINS, { query: '', seasonOnly: false, isInSeason: NEVER_IN_SEASON });
    expect(got.length).toBe(PINS.length);
  });

  it('text query narrows by name (case-insensitive)', () => {
    const got = filterPins(PINS, { query: 'LEH', seasonOnly: false, isInSeason: NEVER_IN_SEASON });
    expect(got.map((p) => p.slug)).toEqual(['leh']);
  });

  it('text query narrows by state', () => {
    const got = filterPins(PINS, {
      query: 'kerala',
      seasonOnly: false,
      isInSeason: NEVER_IN_SEASON,
    });
    expect(got.map((p) => p.slug)).toEqual(['alleppey']);
  });

  it('text query narrows by tagline', () => {
    const got = filterPins(PINS, {
      query: 'ghats',
      seasonOnly: false,
      isInSeason: NEVER_IN_SEASON,
    });
    expect(got.map((p) => p.slug)).toEqual(['varanasi']);
  });

  it('seasonOnly drops every pin when nothing is in season', () => {
    const got = filterPins(PINS, { query: '', seasonOnly: true, isInSeason: NEVER_IN_SEASON });
    expect(got).toEqual([]);
  });

  it('seasonOnly keeps every pin when everything is in season', () => {
    const got = filterPins(PINS, { query: '', seasonOnly: true, isInSeason: ALWAYS_IN_SEASON });
    expect(got.length).toBe(PINS.length);
  });

  it('AND-combines: query+season together', () => {
    // ONLY_KERALA admits alleppey only; a query for 'jaipur' clashes → empty.
    const got = filterPins(PINS, {
      query: 'jaipur',
      seasonOnly: true,
      isInSeason: ONLY_KERALA,
    });
    expect(got).toEqual([]);
  });

  it('AND-combines: query+season match (alleppey survives)', () => {
    const got = filterPins(PINS, {
      query: 'kerala',
      seasonOnly: true,
      isInSeason: ONLY_KERALA,
    });
    expect(got.map((p) => p.slug)).toEqual(['alleppey']);
  });

  it('trims query whitespace before matching', () => {
    const got = filterPins(PINS, {
      query: '   pink   ',
      seasonOnly: false,
      isInSeason: NEVER_IN_SEASON,
    });
    expect(got.map((p) => p.slug)).toEqual(['jaipur']);
  });

  it('whitespace-only query is treated as no query', () => {
    const got = filterPins(PINS, {
      query: '   ',
      seasonOnly: false,
      isInSeason: NEVER_IN_SEASON,
    });
    expect(got.length).toBe(PINS.length);
  });
});
