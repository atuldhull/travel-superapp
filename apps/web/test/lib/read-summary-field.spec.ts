/**
 * Vitest specs for AE224 readSummaryField — the itinerary-day
 * summary-blob field reader.
 */
import { describe, expect, it } from 'vitest';
import { readSummaryField } from '../../src/components/aether/journey/read-summary-field';

describe('readSummaryField', () => {
  it('happy path: returns the string value', () => {
    expect(readSummaryField({ title: 'Day 1: arrive' }, 'title')).toBe('Day 1: arrive');
  });

  it('reads each known key', () => {
    const blob = {
      title: 'T',
      subtitle: 'S',
      theme: 'TH',
      note: 'N',
    };
    expect(readSummaryField(blob, 'title')).toBe('T');
    expect(readSummaryField(blob, 'subtitle')).toBe('S');
    expect(readSummaryField(blob, 'theme')).toBe('TH');
    expect(readSummaryField(blob, 'note')).toBe('N');
  });

  it('null summary → null', () => {
    expect(readSummaryField(null, 'title')).toBeNull();
  });

  it('undefined summary → null', () => {
    expect(readSummaryField(undefined, 'title')).toBeNull();
  });

  it('non-object summary → null', () => {
    expect(readSummaryField('not an object', 'title')).toBeNull();
    expect(readSummaryField(42, 'title')).toBeNull();
    expect(readSummaryField(true, 'title')).toBeNull();
  });

  it('missing key → null', () => {
    expect(readSummaryField({ subtitle: 'has me' }, 'title')).toBeNull();
  });

  it('non-string value → null', () => {
    expect(readSummaryField({ title: 42 }, 'title')).toBeNull();
    expect(readSummaryField({ title: { nested: 'x' } }, 'title')).toBeNull();
    expect(readSummaryField({ title: null }, 'title')).toBeNull();
  });

  it('empty string → null', () => {
    expect(readSummaryField({ title: '' }, 'title')).toBeNull();
  });

  it('whitespace-only → null', () => {
    expect(readSummaryField({ title: '   \t  ' }, 'title')).toBeNull();
  });

  it('preserves internal whitespace in valid values', () => {
    expect(readSummaryField({ title: 'a  b   c' }, 'title')).toBe('a  b   c');
  });

  it('an empty object summary → null for every key', () => {
    const blob = {};
    expect(readSummaryField(blob, 'title')).toBeNull();
    expect(readSummaryField(blob, 'subtitle')).toBeNull();
  });
});
