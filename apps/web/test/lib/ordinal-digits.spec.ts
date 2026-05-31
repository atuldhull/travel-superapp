/**
 * Vitest specs for AE361 ordinalDigits + ordinalLabel.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_ORDINAL_WIDTH, ordinalDigits, ordinalLabel } from '../../src/lib/ordinal-digits';

describe('ordinalDigits', () => {
  it('pads single-digit numbers to 2 chars by default', () => {
    expect(ordinalDigits(1)).toBe('01');
    expect(ordinalDigits(9)).toBe('09');
  });

  it('two-digit numbers pass through unchanged', () => {
    expect(ordinalDigits(10)).toBe('10');
    expect(ordinalDigits(99)).toBe('99');
  });

  it('three-digit numbers are NOT truncated (width = floor, not cap)', () => {
    expect(ordinalDigits(100)).toBe('100');
    expect(ordinalDigits(1234)).toBe('1234');
  });

  it('floors fractional input', () => {
    expect(ordinalDigits(1.7)).toBe('01');
    expect(ordinalDigits(9.99)).toBe('09');
  });

  it('zero → "00"', () => {
    expect(ordinalDigits(0)).toBe('00');
  });

  it('negative → "00" (defensive)', () => {
    expect(ordinalDigits(-1)).toBe('00');
    expect(ordinalDigits(-100)).toBe('00');
  });

  it('NaN / Infinity → "00"', () => {
    expect(ordinalDigits(Number.NaN)).toBe('00');
    expect(ordinalDigits(Number.POSITIVE_INFINITY)).toBe('00');
    expect(ordinalDigits(Number.NEGATIVE_INFINITY)).toBe('00');
  });

  it('width=3 → 3-char zero-pad', () => {
    expect(ordinalDigits(1, 3)).toBe('001');
    expect(ordinalDigits(42, 3)).toBe('042');
  });

  it('width=3 defensive zero on bad input', () => {
    expect(ordinalDigits(Number.NaN, 3)).toBe('000');
  });

  it('DEFAULT_ORDINAL_WIDTH constant is 2', () => {
    expect(DEFAULT_ORDINAL_WIDTH).toBe(2);
  });
});

describe('ordinalLabel', () => {
  it('idx 0 → "01" (1-based)', () => {
    expect(ordinalLabel(0)).toBe('01');
  });

  it('idx 9 → "10"', () => {
    expect(ordinalLabel(9)).toBe('10');
  });

  it('idx 99 → "100"', () => {
    expect(ordinalLabel(99)).toBe('100');
  });

  it('idx -1 → "00" (defensive, was 0 before increment)', () => {
    // -1 + 1 = 0 → "00"
    expect(ordinalLabel(-1)).toBe('00');
  });

  it('honours custom width', () => {
    expect(ordinalLabel(0, 3)).toBe('001');
    expect(ordinalLabel(41, 3)).toBe('042');
  });
});
