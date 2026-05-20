/**
 * I3 (Phase 6) — Offline country-primer cache. Mirrors the most
 * recent `useCountryPrimerControllerGet(cc)` payload (visa info,
 * top-scam categories, emergency numbers, survival phrases) into
 * IndexedDB so the primer page + the phrases page (I5) keep working
 * when the network drops.
 *
 * Keyed by lower-cased country code (`th`, `jp`, `in`, ...). Storing
 * one record per cc means a frequent traveler builds up their own
 * mini editorial library on device automatically.
 *
 * Independent IDB DB from the trip-snapshot cache (`travel.offline-trip-cache.v1`)
 * so primer staleness + trip-snapshot staleness can age independently.
 *
 * Installed by [Phase-6/I3].
 */

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'travel.offline-primer-cache.v1';
const STORE = 'country-primers';

export interface OfflinePrimerSnapshot {
  /** Lower-cased country code; primary key. */
  readonly cc: string;
  /** Full `CountryPrimerDto` payload as returned by the api (envelope `.data`). */
  readonly primer: unknown;
  /** Epoch ms when written. */
  readonly fetchedAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) {
          d.createObjectStore(STORE, { keyPath: 'cc' });
        }
      },
    });
  }
  return dbPromise;
}

/** Normalize a country code to the canonical lower-case form before
 *  hitting IDB. Callers may pass `'TH'`, `'th'`, or `' th '`; the
 *  cache key is always `'th'`. */
function normCc(cc: string): string {
  return cc.trim().toLowerCase();
}

export async function saveCountryPrimer(input: {
  readonly cc: string;
  readonly primer: unknown;
}): Promise<void> {
  if (typeof window === 'undefined') return;
  const cc = normCc(input.cc);
  if (!cc) return;
  try {
    const record: OfflinePrimerSnapshot = {
      cc,
      primer: input.primer,
      fetchedAt: Date.now(),
    };
    const conn = await db();
    await conn.put(STORE, record);
  } catch {
    // Quota / private-mode failures aren't fatal.
  }
}

export async function loadCountryPrimer(cc: string): Promise<OfflinePrimerSnapshot | null> {
  if (typeof window === 'undefined') return null;
  const key = normCc(cc);
  if (!key) return null;
  try {
    const conn = await db();
    const value = (await conn.get(STORE, key)) as OfflinePrimerSnapshot | undefined;
    return value ?? null;
  } catch {
    return null;
  }
}

/** Lists every cached primer, freshest first. Used by I5's phrases
 *  page when no cc is selected ("Which language do you need?"). */
export async function listCountryPrimers(): Promise<readonly OfflinePrimerSnapshot[]> {
  if (typeof window === 'undefined') return [];
  try {
    const conn = await db();
    const all = (await conn.getAll(STORE)) as OfflinePrimerSnapshot[];
    return [...all].sort((a, b) => b.fetchedAt - a.fetchedAt);
  } catch {
    return [];
  }
}

export async function clearCountryPrimer(cc: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const key = normCc(cc);
  if (!key) return;
  try {
    const conn = await db();
    await conn.delete(STORE, key);
  } catch {
    // ignore
  }
}
