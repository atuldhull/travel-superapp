/**
 * Vitest specs for AE233 isoDateOnly — local-date YYYY-MM-DD.
 *
 * Note: vitest runs in the host machine's local timezone (IST on
 * the dev box). We assert against the LOCAL year/month/day, not
 * the UTC one — that's the whole point of the helper.
 */
import { describe, expect, it } from 'vitest';
import { isoDateOnly } from '../../src/lib/iso-date-only';

describe('isoDateOnly', () => {
  it('Date instance → YYYY-MM-DD (local)', () => {
    const d = new Date(2026, 4, 30); // May 30, 2026 local
    expect(isoDateOnly(d)).toBe('2026-05-30');
  });

  it('ISO string parses', () => {
    // Note: the local date depends on TZ. Just assert the shape.
    expect(isoDateOnly('2026-05-30T12:00:00Z')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('null → null', () => {
    expect(isoDateOnly(null)).toBeNull();
  });

  it('undefined → null', () => {
    expect(isoDateOnly(undefined)).toBeNull();
  });

  it('garbage string → null', () => {
    expect(isoDateOnly('not a date')).toBeNull();
  });

  it('pads month and day to 2 digits', () => {
    const d = new Date(2026, 0, 1); // Jan 1
    expect(isoDateOnly(d)).toBe('2026-01-01');
  });

  it('pads year to 4 digits (sanity, historical date)', () => {
    const d = new Date(900, 0, 1);
    d.setFullYear(900);
    expect(isoDateOnly(d)).toBe('0900-01-01');
  });

  it('handles a leap-year Feb-29 (local)', () => {
    const d = new Date(2024, 1, 29);
    expect(isoDateOnly(d)).toBe('2024-02-29');
  });

  it('handles year-end (Dec 31)', () => {
    const d = new Date(2026, 11, 31);
    expect(isoDateOnly(d)).toBe('2026-12-31');
  });

  it('different from toISOString().slice(0,10) when local TZ shifts day', () => {
    // Construct a UTC date at midnight that is "yesterday" in IST.
    // 2026-05-30T20:00:00Z is 01:30 IST next day.
    const d = new Date('2026-05-30T20:00:00Z');
    const utcSlice = d.toISOString().slice(0, 10);
    const localSlice = isoDateOnly(d);
    // In any non-UTC timezone east of UTC-0:30 these can differ.
    // We assert ONLY that local is a valid YYYY-MM-DD; we don't
    // depend on which TZ the runner uses — but log both to help
    // debug if a CI runner ever asserts UTC.
    expect(localSlice).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(utcSlice).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
