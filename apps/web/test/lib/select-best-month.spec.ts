/**
 * Vitest specs for AE298 selectBestMonth.
 */
import { describe, expect, it } from 'vitest';
import { selectBestMonth } from '../../src/components/aether/destinations/select-best-month';

const inJun = new Date(2026, 5, 15); // June
const inDec = new Date(2026, 11, 15); // December

describe('selectBestMonth', () => {
  it('current month wins when in-season', () => {
    expect(selectBestMonth({ months: [6, 7, 8, 9], now: inJun })).toBe('Jun');
  });

  it('out of season → next upcoming', () => {
    expect(selectBestMonth({ months: [10, 11, 12, 1, 2], now: inJun })).toBe('Oct');
  });

  it('Dec wrap → first Jan-Feb-Mar after Dec', () => {
    expect(selectBestMonth({ months: [1, 2, 3], now: inDec })).toBe('Jan');
  });

  it('empty months → null', () => {
    expect(selectBestMonth({ months: [], now: inJun })).toBeNull();
    expect(selectBestMonth({ months: new Set<number>(), now: inJun })).toBeNull();
  });

  it('all 12 months → null (no preference)', () => {
    expect(
      selectBestMonth({ months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], now: inJun }),
    ).toBeNull();
  });

  it('ignores out-of-range month numbers', () => {
    expect(selectBestMonth({ months: [0, 13, 6], now: inJun })).toBe('Jun');
  });

  it('accepts a Set input', () => {
    expect(selectBestMonth({ months: new Set([6, 7]), now: inJun })).toBe('Jun');
  });

  it('singleton far away wraps correctly', () => {
    expect(selectBestMonth({ months: [12], now: inJun })).toBe('Dec');
  });
});
