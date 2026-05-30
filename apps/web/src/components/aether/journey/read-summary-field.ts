/**
 * AE224 — pure helper that reads a string field off the itinerary
 * day's free-form `summary` blob.
 *
 * The itinerary endpoint returns each day with a JSON-shaped
 * `summary` field that the planner / AI can extend with arbitrary
 * keys. Today we read `title`, `subtitle`, `theme`, `note`. The
 * field is `unknown` at the type level, so reads must:
 *   - guard against null/undefined
 *   - guard against non-object payloads
 *   - guard against non-string values
 *   - treat whitespace-only strings as missing
 *
 * Extracted from journey-dashboard so the contract can be tested
 * + shared with trip-pdf-doc + shared-trip-view + future surfaces
 * that want to read the same blob.
 */

export type SummaryKey = 'title' | 'subtitle' | 'theme' | 'note';

export function readSummaryField(summary: unknown, key: SummaryKey): string | null {
  if (summary === null || summary === undefined) return null;
  if (typeof summary !== 'object') return null;
  const v = (summary as Record<string, unknown>)[key];
  return typeof v === 'string' && v.trim().length > 0 ? v : null;
}
