/**
 * Vitest specs for AE228 safeJsonParse — defensive JSON.parse.
 */
import { describe, expect, it } from 'vitest';
import { safeJsonParse } from '../../src/lib/safe-json-parse';

describe('safeJsonParse', () => {
  it('valid JSON object → parses', () => {
    expect(safeJsonParse('{"a":1}', null)).toEqual({ a: 1 });
  });

  it('valid JSON array → parses', () => {
    expect(safeJsonParse('[1,2,3]', null)).toEqual([1, 2, 3]);
  });

  it('valid JSON string → parses', () => {
    expect(safeJsonParse('"hello"', null)).toBe('hello');
  });

  it('null raw → fallback', () => {
    expect(safeJsonParse(null, 'FB')).toBe('FB');
  });

  it('undefined raw → fallback', () => {
    expect(safeJsonParse(undefined, 'FB')).toBe('FB');
  });

  it('non-string raw → fallback', () => {
    expect(safeJsonParse(42, 'FB')).toBe('FB');
    expect(safeJsonParse({ a: 1 }, 'FB')).toBe('FB');
    expect(safeJsonParse([1], 'FB')).toBe('FB');
  });

  it('empty string → fallback', () => {
    expect(safeJsonParse('', 'FB')).toBe('FB');
  });

  it('malformed JSON → fallback', () => {
    expect(safeJsonParse('{not valid', 'FB')).toBe('FB');
    expect(safeJsonParse('}', 'FB')).toBe('FB');
    expect(safeJsonParse('undefined', 'FB')).toBe('FB');
  });

  it('JSON null literal → null (NOT fallback)', () => {
    expect(safeJsonParse<unknown>('null', 'FB')).toBeNull();
  });

  it('JSON false literal → false', () => {
    expect(safeJsonParse<unknown>('false', 'FB')).toBe(false);
  });

  it('fallback type is preserved through TypeScript generics', () => {
    interface Bundle {
      items: string[];
    }
    const fallback: Bundle = { items: [] };
    const got = safeJsonParse<Bundle>('{"items":["a","b"]}', fallback);
    expect(got).toEqual({ items: ['a', 'b'] });
  });
});
