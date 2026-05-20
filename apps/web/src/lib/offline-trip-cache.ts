/**
 * I2 (Phase 6) — Offline trip snapshot cache. Mirrors the most recent
 * successful `tripControllerOverview(tripId)` + `tripControllerGetOne(tripId)`
 * payload into IndexedDB so the trip overview, recap (H5), and memory
 * timeline (H6) keep working when the network drops.
 *
 * Honest scope:
 *  - We cache the raw response envelopes (trip + overview). The
 *    consuming pages already parse defensively via `parseRecapDays`
 *    + `coerceTripDate`, so the cache doesn't need its own schema.
 *  - We don't cache diary entries, media listings, or signed-URL
 *    thumbnails — those are larger / more sensitive. The recap page
 *    surfaces a graceful "diary unavailable offline" state instead.
 *  - We don't cache auth tokens. If the user signs out, the snapshot
 *    is still readable — that's fine because the user already had it
 *    open online; nothing the cache exposes wasn't already on disk.
 *
 * Separate `idb` database from `travel.offline-cache.v1` (near-me)
 * so our store / version lives independently. A failed read returns
 * `null` cleanly so callers can branch.
 *
 * Installed by [Phase-6/I2].
 */

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'travel.offline-trip-cache.v1';
const STORE = 'trip-snapshots';

export interface OfflineTripSnapshot {
  /** Trip id this snapshot belongs to. Indexed by IDB key. */
  readonly tripId: string;
  /** `TripDto` envelope `.data` value as returned by `tripControllerGetOne`. */
  readonly trip: unknown;
  /** Full `tripControllerOverview` response (envelope or unwrapped). */
  readonly overview: unknown;
  /** Epoch ms when this snapshot was last written. */
  readonly savedAt: number;
  /** Optional trip title cached for the home-page memory timeline so
   *  we can render a card without re-parsing the whole snapshot. */
  readonly title: string | null;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) {
          d.createObjectStore(STORE, { keyPath: 'tripId' });
        }
      },
    });
  }
  return dbPromise;
}

/** Write or overwrite a snapshot. Safe to call on every successful
 *  fetch — IDB `put` is idempotent and the `savedAt` timestamp gives
 *  consumers a "this is your offline copy from N minutes ago" signal. */
export async function saveTripSnapshot(input: {
  readonly tripId: string;
  readonly trip: unknown;
  readonly overview: unknown;
  readonly title?: string | null;
}): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!input.tripId) return;
  try {
    const record: OfflineTripSnapshot = {
      tripId: input.tripId,
      trip: input.trip,
      overview: input.overview,
      savedAt: Date.now(),
      title: input.title ?? null,
    };
    const conn = await db();
    await conn.put(STORE, record);
  } catch {
    // Quota / private-mode failures aren't fatal — the next successful
    // fetch overwrites; just lose this one.
  }
}

export async function loadTripSnapshot(tripId: string): Promise<OfflineTripSnapshot | null> {
  if (typeof window === 'undefined') return null;
  if (!tripId) return null;
  try {
    const conn = await db();
    const value = (await conn.get(STORE, tripId)) as OfflineTripSnapshot | undefined;
    return value ?? null;
  } catch {
    return null;
  }
}

/** Lightweight "what do we have cached?" listing for the offline-aware
 *  home surface. Sorted by `savedAt` descending so the freshest sit on
 *  top. */
export async function listTripSnapshots(): Promise<readonly OfflineTripSnapshot[]> {
  if (typeof window === 'undefined') return [];
  try {
    const conn = await db();
    const all = (await conn.getAll(STORE)) as OfflineTripSnapshot[];
    return [...all].sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export async function clearTripSnapshot(tripId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const conn = await db();
    await conn.delete(STORE, tripId);
  } catch {
    // ignore
  }
}

/** Human-friendly "saved 2m ago" string. Returns null when the input
 *  is missing — callers can chain `?? 'a while ago'` if they want. */
export function formatSavedAt(savedAt: number | null | undefined): string | null {
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return null;
  const delta = Math.max(0, Date.now() - savedAt);
  const min = Math.round(delta / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}
