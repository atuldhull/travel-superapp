/**
 * V.UX.7 spontaneous-improviser offline cache. Persists the most
 * recent /near-me response so the page renders meaningful content
 * even when the device drops to airplane mode mid-walk.
 *
 * IndexedDB via `idb` because:
 *   - localStorage is sync + 5MB-ish; a near-me payload is small but
 *     a future "save 5 recent fetches" enhancement fits IndexedDB
 *     cleanly.
 *   - Survives Safari's cache-eviction better than localStorage.
 *
 * The cache stores a single record keyed by `'last'`. Older entries
 * are overwritten on each successful fetch.
 *
 * Installed by prompt [V.UX.7].
 */

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'travel.offline-cache.v1';
const STORE = 'near-me-responses';
const KEY = 'last';

interface CachedNearMe<T> {
  readonly fetchedAt: number;
  readonly center: { readonly lat: number; readonly lng: number };
  readonly response: T;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) {
          d.createObjectStore(STORE);
        }
      },
    });
  }
  return dbPromise;
}

export async function saveNearMeResponse<T>(input: {
  readonly center: { readonly lat: number; readonly lng: number };
  readonly response: T;
}): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const record: CachedNearMe<T> = {
      fetchedAt: Date.now(),
      center: input.center,
      response: input.response,
    };
    const conn = await db();
    await conn.put(STORE, record, KEY);
  } catch {
    // Quota / private-mode failures aren't fatal — the next successful
    // fetch overwrites; just lose this one.
  }
}

export async function loadNearMeResponse<T>(): Promise<CachedNearMe<T> | null> {
  if (typeof window === 'undefined') return null;
  try {
    const conn = await db();
    const value = (await conn.get(STORE, KEY)) as CachedNearMe<T> | undefined;
    return value ?? null;
  } catch {
    return null;
  }
}

export async function clearNearMeResponse(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const conn = await db();
    await conn.delete(STORE, KEY);
  } catch {
    // ignore
  }
}
