/**
 * AE228 — defensive JSON.parse helper.
 *
 * Multiple localStorage readers (AE106 recent prompts, AE94
 * checklist, AE131 my-data, AE140 pulse-history, AE184 persisted-
 * pulse, AE148 checklist import) all wrap JSON.parse in a try/catch
 * that returns a fallback. This helper canonicalises:
 *
 *   safeJsonParse<T>(raw, fallback) →  T | typeof fallback
 *
 * Returns the fallback for:
 *   - null / undefined input
 *   - non-string input
 *   - empty string
 *   - JSON.parse throw
 *
 * Pure, no side-effects.
 */

export function safeJsonParse<T = unknown>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw !== 'string') return fallback;
  if (raw === '') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
