/**
 * Vitest specs for AE303 formatPercentDelta.
 */
import { describe, expect, it } from 'vitest';
import { formatPercentDelta } from '../../src/lib/format-percent-delta';

describe('formatPercentDelta', () => {
  it('positive → "↑ N%"', () => {
    expect(formatPercentDelta(0.15)).toBe('↑ 15%');
  });
  it('negative → "↓ N%" (absolute value)', () => {
    expect(formatPercentDelta(-0.04)).toBe('↓ 4%');
  });
  it('zero → "· 0%"', () => {
    expect(formatPercentDelta(0)).toBe('· 0%');
  });
  it('rounds to whole percent by default', () => {
    expect(formatPercentDelta(0.156)).toBe('↑ 16%');
  });
  it('decimals=2 preserves precision', () => {
    expect(formatPercentDelta(0.156, { decimals: 2 })).toBe('↑ 15.60%');
  });
  it('decimals=1', () => {
    expect(formatPercentDelta(-0.082, { decimals: 1 })).toBe('↓ 8.2%');
  });
  it('large positive (300%)', () => {
    expect(formatPercentDelta(3)).toBe('↑ 300%');
  });
  it('NaN → "—"', () => {
    expect(formatPercentDelta(Number.NaN)).toBe('—');
  });
  it('Infinity → "—"', () => {
    expect(formatPercentDelta(Number.POSITIVE_INFINITY)).toBe('—');
  });
  it('-0 treated as zero (not negative arrow)', () => {
    expect(formatPercentDelta(-0)).toBe('· 0%');
  });
});
