/**
 * Vitest specs for AE264 extractShareCode.
 */
import { describe, expect, it } from 'vitest';
import { extractShareCode } from '../../src/components/aether/journey/share-code-from-url';

describe('extractShareCode', () => {
  it('legacy /shared/<code>', () => {
    expect(extractShareCode('https://app.com/shared/abc123')).toBe('abc123');
  });
  it('aether /aether/shared/<code>', () => {
    expect(extractShareCode('https://app.com/aether/shared/abc123')).toBe('abc123');
  });
  it('relative path /shared/<code>', () => {
    expect(extractShareCode('/shared/xyz')).toBe('xyz');
  });
  it('URL-encoded code is decoded', () => {
    expect(extractShareCode('https://app.com/shared/a%20b')).toBe('a b');
  });
  it('preserves the leading scheme + host', () => {
    expect(extractShareCode('http://localhost:3001/aether/shared/code')).toBe('code');
  });
  it('returns null for an unrelated URL', () => {
    expect(extractShareCode('https://app.com/journey/abc')).toBeNull();
  });
  it('returns null for empty', () => {
    expect(extractShareCode('')).toBeNull();
  });
  it('returns null for whitespace-only', () => {
    expect(extractShareCode('   ')).toBeNull();
  });
  it('strips trailing query string + hash', () => {
    expect(extractShareCode('https://app.com/shared/abc?utm_source=x#hero')).toBe('abc');
  });
  it('trims input', () => {
    expect(extractShareCode('  https://app.com/shared/c  ')).toBe('c');
  });
  it('returns null for malformed encoded code (URIError)', () => {
    expect(extractShareCode('https://app.com/shared/%FF%FF')).toBeNull();
  });
});
