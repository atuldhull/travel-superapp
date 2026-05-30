/**
 * Vitest specs for AE289 formatPercent.
 */
import { describe, expect, it } from 'vitest';
import { formatPercent } from '../../src/lib/format-percent';

describe('formatPercent', () => {
  it('0 → "0%"', () => {
    expect(formatPercent(0)).toBe('0%');
  });
  it('1 → "100%"', () => {
    expect(formatPercent(1)).toBe('100%');
  });
  it('0.5 → "50%"', () => {
    expect(formatPercent(0.5)).toBe('50%');
  });
  it('0.426 → "43%" (round)', () => {
    expect(formatPercent(0.426)).toBe('43%');
  });
  it('decimals=2 preserves precision', () => {
    expect(formatPercent(0.4267, { decimals: 2 })).toBe('42.67%');
  });
  it('clamps > 1', () => {
    expect(formatPercent(1.5)).toBe('100%');
  });
  it('clamps < 0', () => {
    expect(formatPercent(-0.5)).toBe('0%');
  });
  it('NaN → "—"', () => {
    expect(formatPercent(Number.NaN)).toBe('—');
  });
  it('Infinity → "—"', () => {
    expect(formatPercent(Number.POSITIVE_INFINITY)).toBe('—');
  });
  it('decimals=0 explicit matches default', () => {
    expect(formatPercent(0.5, { decimals: 0 })).toBe('50%');
  });
});
