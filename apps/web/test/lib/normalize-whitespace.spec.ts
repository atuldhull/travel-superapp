/**
 * Vitest specs for AE291 normalizeWhitespace.
 */
import { describe, expect, it } from 'vitest';
import { normalizeWhitespace } from '../../src/lib/normalize-whitespace';

describe('normalizeWhitespace', () => {
  it('plain text unchanged', () => {
    expect(normalizeWhitespace('hello world')).toBe('hello world');
  });
  it('collapses multi-space runs', () => {
    expect(normalizeWhitespace('a    b')).toBe('a b');
  });
  it('collapses tabs', () => {
    expect(normalizeWhitespace('a\tb')).toBe('a b');
  });
  it('collapses newlines', () => {
    expect(normalizeWhitespace('a\nb')).toBe('a b');
  });
  it('collapses mixed whitespace', () => {
    expect(normalizeWhitespace('a \t\nb \nc')).toBe('a b c');
  });
  it('trims leading + trailing', () => {
    expect(normalizeWhitespace('   hello   ')).toBe('hello');
  });
  it('empty → ""', () => {
    expect(normalizeWhitespace('')).toBe('');
  });
  it('whitespace-only → ""', () => {
    expect(normalizeWhitespace('   \n\t  ')).toBe('');
  });
});
