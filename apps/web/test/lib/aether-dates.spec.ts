/**
 * Vitest specs for the AE171 shared Aether date helpers.
 */
import { describe, expect, it } from 'vitest';
import {
  asIso,
  daysBetween,
  fmtDate,
  fmtDateOrNull,
  fmtDayHead,
  fmtTime,
  inclusiveDaysBetween,
} from '../../src/lib/aether-dates';

describe('asIso', () => {
  it('passes ISO strings through unchanged', () => {
    expect(asIso('2026-05-30T12:00:00Z')).toBe('2026-05-30T12:00:00Z');
  });
  it('returns null for non-strings', () => {
    expect(asIso(null)).toBeNull();
    expect(asIso(undefined)).toBeNull();
    expect(asIso(0)).toBeNull();
    expect(asIso({})).toBeNull();
    expect(asIso([])).toBeNull();
  });
  it('still returns a string even if it is not a parseable date', () => {
    // Type-coerces; parseability is fmtDate's problem.
    expect(asIso('not-a-date')).toBe('not-a-date');
  });
});

describe('fmtDate', () => {
  it('returns "—" for null / undefined / non-string', () => {
    expect(fmtDate(null)).toBe('—');
    expect(fmtDate(undefined)).toBe('—');
    expect(fmtDate(42)).toBe('—');
  });
  it('returns "—" for unparseable strings', () => {
    expect(fmtDate('garbage')).toBe('—');
  });
  it('renders a parseable date with month + day + year', () => {
    // We assert the shape, not the exact locale output.
    const got = fmtDate('2026-05-30T00:00:00');
    expect(got).toMatch(/2026/);
    expect(got).not.toBe('—');
  });
});

// ─── AE186: fmtTime (itinerary clock) ─────────────────────────────
describe('fmtTime', () => {
  it('returns null for null / non-string', () => {
    expect(fmtTime(null)).toBeNull();
    expect(fmtTime(undefined)).toBeNull();
    expect(fmtTime(42)).toBeNull();
  });
  it('parses naked "HH:MM" clock strings as 12-hr with AM/PM', () => {
    expect(fmtTime('09:30')).toBe('9:30 AM');
    expect(fmtTime('09:30:00')).toBe('9:30 AM');
    expect(fmtTime('00:00:00')).toBe('12:00 AM');
    expect(fmtTime('12:00:00')).toBe('12:00 PM');
    expect(fmtTime('23:45:00')).toBe('11:45 PM');
  });
  it('returns null for clearly unparseable inputs', () => {
    expect(fmtTime('garbage')).toBeNull();
  });
});

// ─── AE187: fmtDayHead (day-card header) ──────────────────────────
describe('fmtDayHead', () => {
  it('returns "—" on null / non-string / unparseable', () => {
    expect(fmtDayHead(null)).toBe('—');
    expect(fmtDayHead(undefined)).toBe('—');
    expect(fmtDayHead('not-a-date')).toBe('—');
  });
  it('renders weekday · short-date for a known date', () => {
    // We assert shape, not the exact locale output.
    const got = fmtDayHead('2026-06-03T00:00:00');
    expect(got).not.toBe('—');
    expect(got).toMatch(/.+ · .+/);
  });
});

describe('daysBetween', () => {
  it('returns null when either input is null', () => {
    expect(daysBetween(null, '2026-06-01')).toBeNull();
    expect(daysBetween('2026-06-01', null)).toBeNull();
  });
  it('returns 0 for same-day strings', () => {
    expect(daysBetween('2026-06-01', '2026-06-01')).toBe(0);
  });
  it('returns a 14-day span for Jun 1 → Jun 15', () => {
    expect(daysBetween('2026-06-01', '2026-06-15')).toBe(14);
  });
  it('returns the positive distance even when reversed (clamps to 0)', () => {
    // The implementation `Math.max(0, …)` means reverse ranges return 0.
    expect(daysBetween('2026-06-15', '2026-06-01')).toBe(0);
  });
  it('returns null on unparseable strings', () => {
    expect(daysBetween('foo', 'bar')).toBeNull();
  });
});

// ─── AE195: inclusiveDaysBetween (share-card convention) ──────────
describe('inclusiveDaysBetween', () => {
  it('returns null when either input is null', () => {
    expect(inclusiveDaysBetween(null, '2026-06-01')).toBeNull();
    expect(inclusiveDaysBetween('2026-06-01', null)).toBeNull();
  });
  it('returns 1 for same-day (inclusive of both endpoints)', () => {
    expect(inclusiveDaysBetween('2026-06-01', '2026-06-01')).toBe(1);
  });
  it('returns 15 for Jun 3 → Jun 17 (the canonical share-card span)', () => {
    expect(inclusiveDaysBetween('2026-06-03', '2026-06-17')).toBe(15);
  });
  it('clamps reverse ranges to 1 (start+1 floor)', () => {
    expect(inclusiveDaysBetween('2026-06-17', '2026-06-03')).toBe(1);
  });
  it('returns null on garbage input', () => {
    expect(inclusiveDaysBetween('foo', 'bar')).toBeNull();
  });
});

// ─── AE356: fmtDateOrNull (variant of fmtDate that returns null) ──
describe('fmtDateOrNull', () => {
  it('returns a locale string for a valid ISO date', () => {
    expect(fmtDateOrNull('2026-06-01')).toMatch(/2026/);
  });

  it('returns null for null input (vs fmtDate "—")', () => {
    expect(fmtDateOrNull(null)).toBeNull();
    expect(fmtDate(null)).toBe('—');
  });

  it('returns null for undefined', () => {
    expect(fmtDateOrNull(undefined)).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(fmtDateOrNull(12345)).toBeNull();
    expect(fmtDateOrNull({})).toBeNull();
  });

  it('returns null for unparseable date strings', () => {
    expect(fmtDateOrNull('not a date')).toBeNull();
  });

  it('handles whitespace-shaped null path consistently with fmtDate', () => {
    // asIso treats empty / whitespace strings as null (typeof check
    // passes but the date parser fails). fmtDateOrNull returns null.
    expect(fmtDateOrNull('')).toBe(
      // empty string → asIso returns '' (not null), new Date('') is invalid → null.
      null,
    );
  });
});
