/**
 * Vitest specs for AE286 formatIsoTime.
 */
import { describe, expect, it } from 'vitest';
import { formatIsoTime } from '../../src/lib/format-iso-time';

describe('formatIsoTime', () => {
  it('null → ""', () => {
    expect(formatIsoTime(null)).toBe('');
  });

  it('undefined → ""', () => {
    expect(formatIsoTime(undefined)).toBe('');
  });

  it('empty string → ""', () => {
    expect(formatIsoTime('')).toBe('');
  });

  it('garbage → ""', () => {
    expect(formatIsoTime('not-a-date')).toBe('');
  });

  it('matches HH:MM shape on a known date', () => {
    expect(formatIsoTime('2026-06-15T10:30:00')).toMatch(/^\d{2}:\d{2}$/);
  });

  it('pads single-digit hour + minute', () => {
    const out = formatIsoTime('2026-06-15T09:05:00');
    expect(out.length).toBe(5);
    expect(out.includes(':')).toBe(true);
  });

  it('Date instance via toISOString round-trip', () => {
    const d = new Date(2026, 5, 15, 14, 7, 0);
    expect(formatIsoTime(d.toISOString())).toMatch(/^\d{2}:\d{2}$/);
  });
});
