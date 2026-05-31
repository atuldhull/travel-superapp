/**
 * Vitest specs for AE296 wrapRowIndex.
 */
import { describe, expect, it } from 'vitest';
import { wrapRowIndex } from '../../src/components/aether/atlas/wrap-row-index';

describe('wrapRowIndex', () => {
  it('passes in-range index through', () => {
    expect(wrapRowIndex(2, 5)).toBe(2);
  });
  it('wraps past the end', () => {
    expect(wrapRowIndex(5, 5)).toBe(0);
    expect(wrapRowIndex(7, 5)).toBe(2);
  });
  it('wraps a negative index from the top end', () => {
    expect(wrapRowIndex(-1, 5)).toBe(4);
    expect(wrapRowIndex(-6, 5)).toBe(4);
  });
  it('index 0 stays 0', () => {
    expect(wrapRowIndex(0, 5)).toBe(0);
  });
  it('empty list → -1 sentinel', () => {
    expect(wrapRowIndex(3, 0)).toBe(-1);
  });
  it('negative total treated as empty', () => {
    expect(wrapRowIndex(0, -1)).toBe(-1);
  });
  it('single-element list always returns 0', () => {
    expect(wrapRowIndex(0, 1)).toBe(0);
    expect(wrapRowIndex(99, 1)).toBe(0);
    expect(wrapRowIndex(-99, 1)).toBe(0);
  });
});
