/**
 * AE106 long-memory recent-prompts store, extracted from pulse.tsx
 * in AE109 so the helpers can be unit-tested without spinning up
 * the Pulse drawer.
 *
 * Lives outside the AE72 conversation persistence so Reset (in-drawer
 * or on /aether/account) does NOT clear it. The list is capped to
 * PULSE_RECENT_CAP entries; appends dedupe (newest moves to front).
 *
 * AE306 — migrated to AE228 safeJsonParse + AE238 safe-storage so the
 * SSR/throw-safety + JSON contract live in one place.
 */
import { readJSON, removeStorage, writeJSON } from '../../../lib/safe-storage';

export const PULSE_RECENT_KEY = 'aether-pulse-recent:v1';
export const PULSE_RECENT_CAP = 10;

export function readRecentPrompts(): string[] {
  const parsed = readJSON<unknown>(PULSE_RECENT_KEY, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((s): s is string => typeof s === 'string').slice(0, PULSE_RECENT_CAP);
}

export function appendRecentPrompt(prompt: string): void {
  const trimmed = prompt.trim();
  if (trimmed === '') return;
  const prior = readRecentPrompts();
  const next = [trimmed, ...prior.filter((p) => p !== trimmed)].slice(0, PULSE_RECENT_CAP);
  writeJSON(PULSE_RECENT_KEY, next);
}

/**
 * AE118 — wipe the Recent prompts list (e.g. from `/aether/me`).
 * Idempotent; safe to call when the key doesn't exist. SSR-safe.
 */
export function clearRecentPrompts(): void {
  removeStorage(PULSE_RECENT_KEY);
}
