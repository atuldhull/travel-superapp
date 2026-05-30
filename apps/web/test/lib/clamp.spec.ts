/**
 * Vitest specs for AE227 clamp / clamp01.
 */
import { describe, expect, it } from 'vitest';
import { clamp, clamp01 } from '../../src/lib/clamp';

describe('clamp', () => {
  it('value within range → unchanged', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it('value below min → min', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });
  it('value above max → max', () => {
    expect(clamp(99, 0, 10)).toBe(10);
  });
  it('value at min boundary → min (closed)', () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });
  it('value at max boundary → max (closed)', () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });
  it('NaN value → NaN (no silent corruption)', () => {
    expect(Number.isNaN(clamp(Number.NaN, 0, 10))).toBe(true);
  });
  it('swapped min/max is tolerated', () => {
    expect(clamp(5, 10, 0)).toBe(5);
    expect(clamp(-1, 10, 0)).toBe(0);
    expect(clamp(99, 10, 0)).toBe(10);
  });
  it('negative range', () => {
    expect(clamp(-3, -10, -1)).toBe(-3);
    expect(clamp(-99, -10, -1)).toBe(-10);
  });
  it('zero-width range pins to the single value', () => {
    expect(clamp(5, 3, 3)).toBe(3);
    expect(clamp(-1, 3, 3)).toBe(3);
  });
});

describe('clamp01', () => {
  it('within → unchanged', () => {
    expect(clamp01(0.5)).toBe(0.5);
  });
  it('below 0 → 0', () => {
    expect(clamp01(-0.1)).toBe(0);
  });
  it('above 1 → 1', () => {
    expect(clamp01(1.1)).toBe(1);
  });
  it('boundary values pass through', () => {
    expect(clamp01(0)).toBe(0);
    expect(clamp01(1)).toBe(1);
  });
});
