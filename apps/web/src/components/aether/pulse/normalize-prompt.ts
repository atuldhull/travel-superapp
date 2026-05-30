/**
 * AE207 — pure prompt-normaliser for the Pulse composer.
 *
 * The ask() flow used to inline `userText.trim()` + an empty-string
 * guard. This helper formalises the contract so it can be tested
 * (and easily extended later — e.g. max-length guard, dedupe
 * trailing punctuation, etc.).
 *
 * Returns a discriminated result:
 *   { ok: true,  text }  — caller may submit
 *   { ok: false }        — caller must NOT submit (empty / too long)
 *
 * Length cap mirrors what the planner endpoint accepts comfortably —
 * 2000 chars is well above any realistic single-sitting prompt and
 * keeps the request payload sane.
 */

export const PULSE_PROMPT_MAX = 2000;

export type NormalizedPrompt =
  | { ok: true; text: string }
  | { ok: false; reason: 'empty' | 'too-long' };

export function normalizePulsePrompt(raw: string): NormalizedPrompt {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: false, reason: 'empty' };
  if (trimmed.length > PULSE_PROMPT_MAX) return { ok: false, reason: 'too-long' };
  return { ok: true, text: trimmed };
}
