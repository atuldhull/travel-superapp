/**
 * V.UX.5 frequent-business-traveler memory: top-5 destinations the
 * caller has used recently, persisted in localStorage. Surfaces as an
 * autocomplete on `/trips/new` so a user who hops between Bangalore /
 * Mumbai / Bengaluru every month doesn't re-type city + coords.
 *
 * Storage shape: `{ entries: FrequentLocation[] }`. Bumped to the
 * front on every recordLocation() call. Capped at 5; older entries
 * fall off LRU-style.
 *
 * Why localStorage and not server-side: it's a per-device convenience,
 * not load-bearing data. A user who switches devices loses the cache
 * but doesn't lose the trips themselves. Token-storage rule (CLAUDE
 * 12) doesn't apply — these are city names + coords, not credentials.
 *
 * Installed by prompt [V.UX.5].
 */

const KEY = 'travel.frequent-locations.v1';
const MAX_ENTRIES = 5;

export interface FrequentLocation {
  readonly title: string;
  readonly lat: number;
  readonly lng: number;
  readonly radiusKm: number;
  /** Unix ms — used for LRU ordering. */
  readonly lastUsedAt: number;
}

interface PersistedShape {
  readonly entries: readonly FrequentLocation[];
}

function read(): readonly FrequentLocation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersistedShape;
    if (!Array.isArray(parsed.entries)) return [];
    return parsed.entries
      .filter(
        (e): e is FrequentLocation =>
          typeof e?.title === 'string' &&
          typeof e?.lat === 'number' &&
          typeof e?.lng === 'number' &&
          typeof e?.radiusKm === 'number' &&
          typeof e?.lastUsedAt === 'number',
      )
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

function write(entries: readonly FrequentLocation[]): void {
  if (typeof window === 'undefined') return;
  try {
    const shape: PersistedShape = { entries };
    window.localStorage.setItem(KEY, JSON.stringify(shape));
  } catch {
    // Quota / private-mode failures aren't worth surfacing — the
    // autocomplete just won't persist this session.
  }
}

/**
 * Read the cached frequent locations, most-recent-first. Filtered by
 * a case-insensitive title prefix when `query` is non-empty.
 */
export function listFrequentLocations(query: string = ''): readonly FrequentLocation[] {
  const all = [...read()].sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  if (!query.trim()) return all;
  const needle = query.trim().toLowerCase();
  return all.filter((e) => e.title.toLowerCase().includes(needle));
}

/**
 * Bump or insert a location. If the title (case-insensitive) already
 * exists, its entry is updated in-place + moved to the front; else a
 * fresh entry is prepended and the list is truncated to 5.
 */
export function recordLocation(input: {
  title: string;
  lat: number;
  lng: number;
  radiusKm: number;
}): void {
  const trimmed = input.title.trim();
  if (!trimmed) return;
  const existing = read();
  const lower = trimmed.toLowerCase();
  const without = existing.filter((e) => e.title.toLowerCase() !== lower);
  const next: FrequentLocation = {
    title: trimmed,
    lat: input.lat,
    lng: input.lng,
    radiusKm: input.radiusKm,
    lastUsedAt: Date.now(),
  };
  write([next, ...without].slice(0, MAX_ENTRIES));
}

/** Clear all entries — exposed for tests + a future "clear history"
 *  affordance in user settings. */
export function clearFrequentLocations(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
