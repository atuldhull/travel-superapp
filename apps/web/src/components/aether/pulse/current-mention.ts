/**
 * AE363 — pure cursor-aware @-mention detector.
 *
 * Sibling of AE304 `extractMentions` (which scans the whole prompt).
 * This one answers: "is the cursor sitting inside an @-mention right
 * now, and if so what has the user typed after the @?" Used by the
 * AE364 autocomplete drawer.
 *
 * Rule:
 *   - Find the last '@' at-or-before `cursor`.
 *   - If the char before that '@' is alphanumeric (e.g. an email
 *     address: "me@example") → not a fresh mention, return null.
 *   - If the chars between '@' and `cursor` contain anything outside
 *     [a-z0-9_-] (case-insensitive) → return null (mention closed).
 *   - Otherwise return `{start, end, query}` where `start` is the
 *     index of '@', `end` is `cursor`, `query` is the lowercased
 *     chars between (may be empty — just-typed '@' opens the picker).
 *
 * Pure: no DOM, no React. Specs lock the contract.
 */

export interface PendingMention {
  /** Index of the '@' in the source text. */
  readonly start: number;
  /** Cursor position (exclusive end of the mention slice). */
  readonly end: number;
  /** Lowercased characters typed after '@'; '' when user just hit '@'. */
  readonly query: string;
}

const MENTION_CHAR_RE = /[a-z0-9_-]/i;

export function currentMentionAtCursor(text: string, cursor: number): PendingMention | null {
  if (typeof text !== 'string' || text === '') return null;
  // Clamp cursor so callers pass `selectionStart` without pre-validation.
  const c = Math.max(0, Math.min(cursor, text.length));
  // Walk back from cursor to find the most recent '@' or a non-mention char.
  let at = -1;
  for (let i = c - 1; i >= 0; i--) {
    const ch = text[i]!;
    if (ch === '@') {
      at = i;
      break;
    }
    if (!MENTION_CHAR_RE.test(ch)) {
      // Hit a separator before any '@' — not in a mention.
      return null;
    }
  }
  if (at < 0) return null;
  // Don't trigger on email-style usernames: the char before @ must be
  // a separator (whitespace, punctuation, or start-of-text).
  if (at > 0) {
    const prev = text[at - 1]!;
    if (MENTION_CHAR_RE.test(prev)) return null;
  }
  const query = text.slice(at + 1, c).toLowerCase();
  return { start: at, end: c, query };
}

/** Returns the new text with the pending mention's query replaced by
 *  `slug`. No-op (returns `text`) when there is no pending mention.
 *  Trailing whitespace is preserved verbatim. */
export function applyMentionCompletion(
  text: string,
  cursor: number,
  slug: string,
): { text: string; cursor: number } {
  const m = currentMentionAtCursor(text, cursor);
  if (m === null) return { text, cursor };
  const head = text.slice(0, m.start);
  const tail = text.slice(m.end);
  const inserted = `@${slug}`;
  return {
    text: `${head}${inserted}${tail}`,
    cursor: head.length + inserted.length,
  };
}
