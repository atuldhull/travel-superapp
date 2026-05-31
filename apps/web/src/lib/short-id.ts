/**
 * AE353 — pure "first 4 … last 4" id elider.
 *
 * Used in /aether/account to display the user's `sub` (sub-claim
 * from the token) without a 40-char string dominating the row.
 * Lifting makes the rule unit-locked and reusable (a future trip-id
 * surface, share-code preview, etc.).
 *
 * Rule:
 *   length <= 8 → return as-is
 *   else        → `${head4}…${tail4}` (one-char ellipsis)
 *
 * Returns `''` for non-string input so callers can `?? '—'` if they
 * want a placeholder.
 */

export const SHORT_ID_THRESHOLD = 8;
export const SHORT_ID_HEAD = 4;
export const SHORT_ID_TAIL = 4;
export const SHORT_ID_ELLIPSIS = '…';

export function shortId(value: unknown): string {
  if (typeof value !== 'string') return '';
  if (value.length <= SHORT_ID_THRESHOLD) return value;
  const head = value.slice(0, SHORT_ID_HEAD);
  const tail = value.slice(-SHORT_ID_TAIL);
  return `${head}${SHORT_ID_ELLIPSIS}${tail}`;
}
