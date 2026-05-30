/**
 * Vitest specs for the AE191 Atlas Esc-in-filter decision helper.
 */
import { describe, expect, it } from 'vitest';
import { decideFilterEsc } from '../../src/components/aether/atlas/esc-behaviour';

describe('decideFilterEsc', () => {
  it('returns null for non-Escape keys', () => {
    expect(decideFilterEsc('Enter', false)).toBeNull();
    expect(decideFilterEsc('a', true)).toBeNull();
    expect(decideFilterEsc('', true)).toBeNull();
  });

  it("returns 'clear' when Escape fires on a non-empty filter", () => {
    expect(decideFilterEsc('Escape', true)).toBe('clear');
  });

  it("returns 'focus-row-0' when Escape fires on an empty filter", () => {
    expect(decideFilterEsc('Escape', false)).toBe('focus-row-0');
  });

  it('is case-sensitive: lowercase "escape" is NOT the same as "Escape"', () => {
    expect(decideFilterEsc('escape', true)).toBeNull();
  });
});
