/**
 * Vitest specs for AE277 formatBytes.
 */
import { describe, expect, it } from 'vitest';
import { formatBytes } from '../../src/lib/format-bytes';

describe('formatBytes (binary)', () => {
  it('0 → "0 B"', () => {
    expect(formatBytes(0)).toBe('0 B');
  });
  it('1023 → "1023 B" (just under base)', () => {
    expect(formatBytes(1023)).toBe('1023 B');
  });
  it('1024 → "1.0 KiB"', () => {
    expect(formatBytes(1024)).toBe('1.0 KiB');
  });
  it('1 MiB', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MiB');
  });
  it('1.5 MiB', () => {
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MiB');
  });
  it('1 GiB', () => {
    expect(formatBytes(1024 ** 3)).toBe('1.0 GiB');
  });
  it('1 TiB', () => {
    expect(formatBytes(1024 ** 4)).toBe('1.0 TiB');
  });
  it('huge number caps at TiB', () => {
    expect(formatBytes(1024 ** 6)).toMatch(/TiB$/);
  });
});

describe('formatBytes (decimal)', () => {
  it('1000 → "1.0 KB" in decimal mode', () => {
    expect(formatBytes(1000, { decimal: true })).toBe('1.0 KB');
  });
  it('1_000_000 → "1.0 MB"', () => {
    expect(formatBytes(1_000_000, { decimal: true })).toBe('1.0 MB');
  });
});

describe('formatBytes edge cases', () => {
  it('negative → "—"', () => {
    expect(formatBytes(-1)).toBe('—');
  });
  it('NaN → "—"', () => {
    expect(formatBytes(Number.NaN)).toBe('—');
  });
  it('Infinity → "—"', () => {
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('—');
  });
  it('rounds bytes < base to whole number', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(512.4)).toBe('512 B');
    expect(formatBytes(512.6)).toBe('513 B');
  });
});
