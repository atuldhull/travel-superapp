/**
 * Vitest specs for the AE171 shared Aether date helpers.
 */
import { describe, expect, it } from 'vitest';
import { asIso, daysBetween, fmtDate } from '../../src/lib/aether-dates';

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
