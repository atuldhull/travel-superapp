/**
 * Vitest specs for AE353 shortId.
 */
import { describe, expect, it } from 'vitest';
import {
  SHORT_ID_ELLIPSIS,
  SHORT_ID_HEAD,
  SHORT_ID_TAIL,
  SHORT_ID_THRESHOLD,
  shortId,
} from '../../src/lib/short-id';

describe('shortId', () => {
  it('empty string → ""', () => {
    expect(shortId('')).toBe('');
  });

  it('length below threshold returned verbatim', () => {
    expect(shortId('abc')).toBe('abc');
    expect(shortId('1234567')).toBe('1234567');
    expect(shortId('12345678')).toBe('12345678');
  });

  it('length 9 → head 4 + … + tail 4', () => {
    expect(shortId('123456789')).toBe('1234…6789');
  });

  it('uuid-ish input → 4-then-… -then-4', () => {
    expect(shortId('cm6h2y8a4000007l9br2j5xfx')).toBe('cm6h…5xfx');
  });

  it('non-string → ""', () => {
    expect(shortId(undefined)).toBe('');
    expect(shortId(null)).toBe('');
    expect(shortId(12345)).toBe('');
    expect(shortId({})).toBe('');
  });

  it('constants reflect the 4 / … / 4 / 8 contract', () => {
    expect(SHORT_ID_THRESHOLD).toBe(8);
    expect(SHORT_ID_HEAD).toBe(4);
    expect(SHORT_ID_TAIL).toBe(4);
    expect(SHORT_ID_ELLIPSIS).toBe('…');
  });

  it('output length never exceeds head+1+tail when elision triggers', () => {
    for (const s of ['1234567890', 'abcdefghijklmnop', 'x'.repeat(50)]) {
      const out = shortId(s);
      if (s.length > SHORT_ID_THRESHOLD) {
        expect(out.length).toBe(SHORT_ID_HEAD + 1 + SHORT_ID_TAIL);
      }
    }
  });
});
