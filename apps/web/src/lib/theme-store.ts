/**
 * Theme store — three-state ("light" | "dark" | "system") preference
 * persisted to `localStorage` (theme is NOT a security secret, unlike
 * auth tokens — CLAUDE rule 12 doesn't apply here).
 *
 * The applied class on `<html>` is computed:
 *   - "light"  → no class
 *   - "dark"   → `class="dark"`
 *   - "system" → `class="dark"` iff `prefers-color-scheme: dark`
 *
 * To avoid a flash-of-wrong-theme on first paint, the inline script
 * in `apps/web/src/app/layout.tsx` reads localStorage + the OS
 * preference and applies the class BEFORE React hydrates. After
 * hydration the React `<ThemeToggle>` keeps the store and the DOM
 * class in sync.
 *
 * Installed by prompt [IV.18.19.28].
 */

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'travel-web-theme';
const subscribers = new Set<() => void>();

let cached: ThemePreference | null = null;

function readFromStorage(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return 'system';
}

export function getThemePreference(): ThemePreference {
  if (cached !== null) return cached;
  cached = readFromStorage();
  return cached;
}

export function setThemePreference(next: ThemePreference): void {
  cached = next;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, next);
  }
  applyTheme(next);
  for (const sub of subscribers) sub();
}

export function subscribeToTheme(listener: () => void): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

/**
 * Resolve "system" against the OS preference and toggle the `dark`
 * class on `<html>`. Safe to call on the server (no-op).
 */
export function applyTheme(pref: ThemePreference): void {
  if (typeof document === 'undefined') return;
  const isDark =
    pref === 'dark' ||
    (pref === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}
