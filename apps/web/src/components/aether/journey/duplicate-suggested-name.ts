/**
 * AE276 — pure suggested-name helper for the AE42 trip duplicate.
 *
 * When a user duplicates a trip, the new copy should suggest a
 * non-clashing name like "Leh winter trip (2)" or "Leh winter
 * trip (copy)". Rule:
 *
 *   1. If title doesn't already have a "(N)" suffix → "<title> (copy)"
 *   2. If title is "<title> (copy)" → "<title> (copy 2)"
 *   3. If title is "<title> (copy N)" → "<title> (copy N+1)"
 *
 * Trims input + caps result at 100 chars (commitlint-friendly +
 * matches our TripDto.title max).
 */

export const SUGGESTED_NAME_MAX = 100;

function truncate(s: string): string {
  if (s.length <= SUGGESTED_NAME_MAX) return s;
  return s.slice(0, SUGGESTED_NAME_MAX);
}

export function suggestedDuplicateName(originalTitle: string): string {
  const trimmed = originalTitle.trim();
  if (trimmed === '') return '(copy)';
  const match = /^(.*?)\s*\(copy(?:\s+(\d+))?\)\s*$/i.exec(trimmed);
  if (match === null) return truncate(`${trimmed} (copy)`);
  const base = (match[1] ?? '').trimEnd();
  const num = match[2] !== undefined ? Number.parseInt(match[2], 10) : 1;
  const next = Number.isFinite(num) ? num + 1 : 2;
  return truncate(`${base} (copy ${next})`);
}
