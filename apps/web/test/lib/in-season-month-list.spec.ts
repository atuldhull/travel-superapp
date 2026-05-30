/**
 * Vitest specs for AE248 formatInSeasonMonths.
 */
import { describe, expect, it } from 'vitest';
import { formatInSeasonMonths } from '../../src/components/aether/destinations/in-season-month-list';

describe('formatInSeasonMonths', () => {
  it('empty → "—"', () => {
    expect(formatInSeasonMonths(new Set<number>())).toBe('—');
    expect(formatInSeasonMonths([])).toBe('—');
  });

  it('all 12 months → "Year-round"', () => {
    expect(formatInSeasonMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe('Year-round');
  });

  it('single month → "Mar"', () => {
    expect(formatInSeasonMonths([3])).toBe('Mar');
  });

  it('contiguous range Jun-Sep (Leh)', () => {
    expect(formatInSeasonMonths([6, 7, 8, 9])).toBe('Jun–Sep');
  });

  it('contiguous range Oct-Mar wraparound (Rajasthan)', () => {
    expect(formatInSeasonMonths([10, 11, 12, 1, 2, 3])).toBe('Oct–Mar');
  });

  it('contiguous wraparound Dec-Mar (Kerala)', () => {
    expect(formatInSeasonMonths([12, 1, 2, 3])).toBe('Dec–Mar');
  });

  it('non-contiguous → comma list', () => {
    expect(formatInSeasonMonths([1, 3, 5])).toBe('Jan, Mar, May');
  });

  it('Coorg pattern: Sep + Oct-Mar wraparound forms a single Sep-Mar range', () => {
    // Coorg = Y(10,11,12,1,2,3,9) — sorted = 1,2,3,9,10,11,12
    // The Dec→Jan wrap + the Sep→Oct contiguity combine: tail = Sep-Dec,
    // head = Jan-Mar → "Sep–Mar". This matches the natural English idiom
    // ("season runs Sep through Mar").
    expect(formatInSeasonMonths([10, 11, 12, 1, 2, 3, 9])).toBe('Sep–Mar');
  });

  it('truly non-contiguous (gap on BOTH halves) → comma list', () => {
    // 2,5,8 → all 1-gap-apart fails, no wrap → comma list.
    expect(formatInSeasonMonths([2, 5, 8])).toBe('Feb, May, Aug');
  });

  it('ignores month-numbers outside 1-12', () => {
    expect(formatInSeasonMonths([0, 13, 6])).toBe('Jun');
  });

  it('accepts a Set as input', () => {
    expect(formatInSeasonMonths(new Set([6, 7, 8, 9]))).toBe('Jun–Sep');
  });

  it('input order does not matter', () => {
    expect(formatInSeasonMonths([3, 1, 2])).toBe('Jan–Mar');
  });
});
