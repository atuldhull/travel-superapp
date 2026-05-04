/**
 * V.UX.35 — module-scope active-SOS store. The SosFab pushes here
 * on success; the ActiveSosBanner subscribes so it can render the
 * sticky "I'm OK" cancel + local-emergency numbers without a
 * server round-trip on every page render.
 *
 * Persisted to sessionStorage so a hard reload mid-emergency
 * doesn't lose the active-SOS state. Cleared on successful cancel.
 *
 * Installed by prompt [V.UX.35].
 */
const KEY = 'travel-active-sos';

export interface ActiveSosState {
  readonly id: string;
  readonly triggeredAt: string;
  readonly lat: number;
  readonly lng: number;
  /** Best-effort country code derived from geolocation; the banner
   *  uses it to fetch local emergency numbers. Null when we couldn't
   *  determine it (anonymous, denied geolocation, etc.). */
  readonly countryCode: string | null;
}

type Listener = (s: ActiveSosState | null) => void;
const listeners = new Set<Listener>();
let cached: ActiveSosState | null | undefined = undefined;

function load(): ActiveSosState | null {
  if (typeof window === 'undefined') return null;
  if (cached !== undefined) return cached;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    cached = raw ? (JSON.parse(raw) as ActiveSosState) : null;
  } catch {
    cached = null;
  }
  return cached;
}

function persist(state: ActiveSosState | null): void {
  cached = state;
  if (typeof window === 'undefined') return;
  try {
    if (state === null) window.sessionStorage.removeItem(KEY);
    else window.sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* sessionStorage full / disabled — fall through. */
  }
}

export function getActiveSos(): ActiveSosState | null {
  return load();
}

export function setActiveSos(state: ActiveSosState | null): void {
  persist(state);
  for (const fn of listeners) fn(state);
}

export function subscribeActiveSos(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
