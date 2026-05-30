/**
 * Vitest specs for AE240 url-params helpers.
 */
import { describe, expect, it } from 'vitest';
import { appendQuery, buildQueryString } from '../../src/lib/url-params';

describe('buildQueryString', () => {
  it('empty params → empty string', () => {
    expect(buildQueryString({})).toBe('');
  });

  it('single key=value', () => {
    expect(buildQueryString({ a: '1' })).toBe('a=1');
  });

  it('multiple keys are sorted alphabetically (deterministic)', () => {
    expect(buildQueryString({ b: '2', a: '1' })).toBe('a=1&b=2');
  });

  it('omits null + undefined values', () => {
    expect(buildQueryString({ a: '1', b: null, c: undefined, d: '4' })).toBe('a=1&d=4');
  });

  it('omits empty-string values', () => {
    expect(buildQueryString({ a: '1', b: '' })).toBe('a=1');
  });

  it('coerces number to string', () => {
    expect(buildQueryString({ n: 42 })).toBe('n=42');
  });

  it('URL-encodes both key and value', () => {
    expect(buildQueryString({ 'a key': 'a value' })).toBe('a%20key=a%20value');
  });

  it('encodes ampersand + equals in values', () => {
    expect(buildQueryString({ q: 'a=b&c' })).toBe('q=a%3Db%26c');
  });
});

describe('appendQuery', () => {
  it('empty params → path unchanged', () => {
    expect(appendQuery('/x', {})).toBe('/x');
  });

  it('appends with "?" on a clean path', () => {
    expect(appendQuery('/x', { a: '1' })).toBe('/x?a=1');
  });

  it('appends with "&" when path already has a query', () => {
    expect(appendQuery('/x?z=0', { a: '1' })).toBe('/x?z=0&a=1');
  });

  it('preserves trailing slash', () => {
    expect(appendQuery('/x/', { a: '1' })).toBe('/x/?a=1');
  });

  it('all-omitted params → path unchanged', () => {
    expect(appendQuery('/x', { a: null, b: '' })).toBe('/x');
  });
});
