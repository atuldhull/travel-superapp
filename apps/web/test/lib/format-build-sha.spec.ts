/**
 * Vitest specs for AE349 formatBuildSha.
 */
import { describe, expect, it } from 'vitest';
import { SHORT_SHA_LENGTH, formatBuildSha } from '../../src/lib/format-build-sha';

describe('formatBuildSha', () => {
  it('typical 40-char SHA → first 7 chars', () => {
    expect(formatBuildSha('a1b2c3d4e5f6789012345678901234567890abcd')).toBe('a1b2c3d');
  });

  it('input shorter than 7 → returned verbatim', () => {
    expect(formatBuildSha('abc12')).toBe('abc12');
  });

  it('exactly 7 → returned verbatim', () => {
    expect(formatBuildSha('1234567')).toBe('1234567');
  });

  it('empty string → null', () => {
    expect(formatBuildSha('')).toBeNull();
  });

  it('whitespace-only → null', () => {
    expect(formatBuildSha('   ')).toBeNull();
  });

  it('trims leading + trailing whitespace before slicing', () => {
    expect(formatBuildSha('  abcdefghij  ')).toBe('abcdefg');
  });

  it('non-string input → null (defensive)', () => {
    expect(formatBuildSha(undefined)).toBeNull();
    expect(formatBuildSha(null)).toBeNull();
    expect(formatBuildSha(12345)).toBeNull();
    expect(formatBuildSha({})).toBeNull();
  });

  it('SHORT_SHA_LENGTH constant is 7 (git short-sha convention)', () => {
    expect(SHORT_SHA_LENGTH).toBe(7);
  });
});
