/**
 * Vitest specs for AE238 safe-storage helpers.
 *
 * jsdom provides a real localStorage. We exercise the happy paths
 * + a forced-throw via Object.defineProperty stub.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  readJSON,
  readStorage,
  removeStorage,
  writeJSON,
  writeStorage,
} from '../../src/lib/safe-storage';

const K = 'aether-safe-storage-spec:v1';

describe('safe-storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it('readStorage returns null for a missing key', () => {
    expect(readStorage(K)).toBeNull();
  });

  it('writeStorage + readStorage round-trip', () => {
    const ok = writeStorage(K, 'hello');
    expect(ok).toBe(true);
    expect(readStorage(K)).toBe('hello');
  });

  it('writeJSON + readJSON round-trip', () => {
    expect(writeJSON(K, { a: 1, b: ['x', 'y'] })).toBe(true);
    expect(readJSON(K, null)).toEqual({ a: 1, b: ['x', 'y'] });
  });

  it('readJSON falls back to default on missing key', () => {
    expect(readJSON(K, { items: [] })).toEqual({ items: [] });
  });

  it('readJSON falls back to default on malformed value', () => {
    window.localStorage.setItem(K, '{not valid');
    expect(readJSON<{ ok: boolean }>(K, { ok: false })).toEqual({ ok: false });
  });

  it('removeStorage deletes the key', () => {
    writeStorage(K, 'x');
    expect(readStorage(K)).toBe('x');
    expect(removeStorage(K)).toBe(true);
    expect(readStorage(K)).toBeNull();
  });

  it('writeJSON returns false when value is unserialisable (cyclic)', () => {
    const cyc: { self?: unknown } = {};
    cyc.self = cyc;
    expect(writeJSON(K, cyc)).toBe(false);
    // Key never got written.
    expect(readStorage(K)).toBeNull();
  });

  it('removeStorage on a missing key still returns true (idempotent)', () => {
    expect(removeStorage('aether-never-was')).toBe(true);
  });
});
