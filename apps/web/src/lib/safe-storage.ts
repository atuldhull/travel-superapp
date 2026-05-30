/**
 * AE238 — defensive localStorage wrapper.
 *
 * Several Aether surfaces call window.localStorage directly with
 * the same pattern: typeof window !== 'undefined' guard + try/catch
 * because localStorage throws in incognito + quota-exhausted
 * scenarios. This helper canonicalises:
 *
 *   readStorage(key)         → string | null
 *   readJSON(key, fallback)  → T | typeof fallback (uses AE228 safeJsonParse)
 *   writeStorage(key, value) → boolean (true iff committed)
 *   writeJSON(key, value)    → boolean
 *   removeStorage(key)       → boolean
 *
 * All paths SSR-safe (returns null / false when window is undefined)
 * and never throws.
 */

import { safeJsonParse } from './safe-json-parse';

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStorage(key: string): string | null {
  const s = getStorage();
  if (s === null) return null;
  try {
    return s.getItem(key);
  } catch {
    return null;
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  return safeJsonParse<T>(readStorage(key), fallback);
}

export function writeStorage(key: string, value: string): boolean {
  const s = getStorage();
  if (s === null) return false;
  try {
    s.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  try {
    return writeStorage(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

export function removeStorage(key: string): boolean {
  const s = getStorage();
  if (s === null) return false;
  try {
    s.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
