/**
 * V.UX.15 — comfort-mode store. Mirrors theme-store.ts:
 *   - Persisted to localStorage (theme posture: not a security
 *     secret, CLAUDE rule 12 doesn't apply).
 *   - Inline boot script in `app/layout.tsx` reads localStorage
 *     and applies the `.comfort` class on `<html>` BEFORE React
 *     hydrates so there's no flash-of-wrong-density.
 *   - When the caller is signed in, the /account/preferences page
 *     mirrors the value back to the server so it follows the user
 *     across devices on next sign-in.
 *
 * The applied class is purely `.comfort` on `<html>`; CSS overrides
 * live in `globals.css`.
 *
 * Installed by prompt [V.UX.15].
 */

const STORAGE_KEY = 'travel-web-comfort';
const subscribers = new Set<() => void>();

let cached: boolean | null = null;

function readFromStorage(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(STORAGE_KEY) === 'on';
}

export function getComfortMode(): boolean {
  if (cached !== null) return cached;
  cached = readFromStorage();
  return cached;
}

export function setComfortMode(next: boolean): void {
  cached = next;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
    applyComfortClass(next);
  }
  for (const sub of subscribers) sub();
}

export function subscribeToComfortMode(listener: () => void): () => void {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

function applyComfortClass(enabled: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('comfort', enabled);
}
