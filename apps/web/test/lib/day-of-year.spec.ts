/**
 * Vitest specs for AE341 dayOfYear.
 */
import { describe, expect, it } from 'vitest';
import { dayOfYear } from '../../src/lib/day-of-year';

describe('dayOfYear', () => {
  it('Jan 1 → 1', () => {
    expect(dayOfYear(new Date(2026, 0, 1))).toBe(1);
  });

  it('Jan 2 → 2', () => {
    expect(dayOfYear(new Date(2026, 0, 2))).toBe(2);
  });

  it('Feb 1 → 32 (after a 31-day January)', () => {
    expect(dayOfYear(new Date(2026, 1, 1))).toBe(32);
  });

  it('Dec 31 → 365 on a non-leap year', () => {
    expect(dayOfYear(new Date(2026, 11, 31))).toBe(365);
  });

  it('Dec 31 → 366 on a leap year (2024)', () => {
    expect(dayOfYear(new Date(2024, 11, 31))).toBe(366);
  });

  it('Feb 29 → 60 on a leap year', () => {
    expect(dayOfYear(new Date(2024, 1, 29))).toBe(60);
  });

  it('same calendar day → same number regardless of time', () => {
    const a = new Date(2026, 5, 15, 0, 0, 0);
    const b = new Date(2026, 5, 15, 23, 59, 59);
    expect(dayOfYear(a)).toBe(dayOfYear(b));
  });

  it('NaN date → 0 (safe fallback for seeds)', () => {
    expect(dayOfYear(new Date('not a date'))).toBe(0);
  });

  it('result is always an integer', () => {
    for (const m of [0, 3, 6, 9, 11]) {
      const v = dayOfYear(new Date(2026, m, 15));
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('returns the same value for any year-start (Jan 1) regardless of year', () => {
    for (const y of [2000, 2024, 2026, 2100]) {
      expect(dayOfYear(new Date(y, 0, 1))).toBe(1);
    }
  });
});
