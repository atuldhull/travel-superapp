/**
 * Vitest specs for AE223 plural / pluralise / countLabel.
 */
import { describe, expect, it } from 'vitest';
import { countLabel, plural, pluralise } from '../../src/lib/pluralise';

describe('plural', () => {
  it('1 → singular', () => {
    expect(plural(1, 'day', 'days')).toBe('day');
  });
  it('2 → plural', () => {
    expect(plural(2, 'day', 'days')).toBe('days');
  });
  it('0 → plural', () => {
    expect(plural(0, 'day', 'days')).toBe('days');
  });
  it('negative → plural', () => {
    expect(plural(-1, 'day', 'days')).toBe('days');
  });
  it('non-integer → plural ("1.5 days" reads correctly)', () => {
    expect(plural(1.5, 'day', 'days')).toBe('days');
  });
});

describe('pluralise (auto -s suffix)', () => {
  it('1 → singular', () => {
    expect(pluralise(1, 'day')).toBe('day');
  });
  it('5 → singular + "s"', () => {
    expect(pluralise(5, 'day')).toBe('days');
  });
  it('explicit plural overrides auto-s', () => {
    expect(pluralise(2, 'cactus', 'cacti')).toBe('cacti');
  });
  it('1 with explicit plural still returns singular', () => {
    expect(pluralise(1, 'cactus', 'cacti')).toBe('cactus');
  });
});

describe('countLabel', () => {
  it('1 day', () => {
    expect(countLabel(1, 'day')).toBe('1 day');
  });
  it('3 days', () => {
    expect(countLabel(3, 'day')).toBe('3 days');
  });
  it('0 days', () => {
    expect(countLabel(0, 'day')).toBe('0 days');
  });
  it('respects explicit plural form (1 share / 2 shares)', () => {
    expect(countLabel(1, 'share', 'shares')).toBe('1 share');
    expect(countLabel(2, 'share', 'shares')).toBe('2 shares');
  });
  it('exotic plural (1 cactus / 7 cacti)', () => {
    expect(countLabel(1, 'cactus', 'cacti')).toBe('1 cactus');
    expect(countLabel(7, 'cactus', 'cacti')).toBe('7 cacti');
  });
});
