/**
 * AE106 long-memory recent-prompts store, extracted from pulse.tsx
 * in AE109 so the helpers can be unit-tested without spinning up
 * the Pulse drawer.
 *
 * Lives outside the AE72 conversation persistence so Reset (in-drawer
 * or on /aether/account) does NOT clear it. The list is capped to
 * PULSE_RECENT_CAP entries; appends dedupe (newest moves to front).
 */
export const PULSE_RECENT_KEY = 'aether-pulse-recent:v1';
export const PULSE_RECENT_CAP = 10;

export function readRecentPrompts(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PULSE_RECENT_KEY);
    if (raw === null) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === 'string').slice(0, PULSE_RECENT_CAP);
  } catch {
    return [];
  }
}

export function appendRecentPrompt(prompt: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = prompt.trim();
  if (trimmed === '') return;
  try {
    const prior = readRecentPrompts();
    const next = [trimmed, ...prior.filter((p) => p !== trimmed)].slice(0, PULSE_RECENT_CAP);
    window.localStorage.setItem(PULSE_RECENT_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}

/**
 * AE118 — wipe the Recent prompts list (e.g. from `/aether/me`).
 * Idempotent; safe to call when the key doesn't exist. SSR-safe.
 */
export function clearRecentPrompts(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PULSE_RECENT_KEY);
  } catch {
    /* private mode */
  }
}
