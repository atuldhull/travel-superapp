/**
 * AE371 — pure expander that rewrites `@slug` references into the
 * canonical destination name + state, e.g. `@leh` → `Leh (Ladakh)`.
 *
 * Used in Pulse's `ask()` flow: the user types `@leh + @alleppey for
 * five days`, the model receives `Leh (Ladakh) + Alleppey (Kerala)
 * for five days`. The model never sees the slug syntax, so its
 * geocoding / destination-recognition stays clean.
 *
 * Rules:
 *   - `@<slug>` matched case-insensitively; output uses lookup's case
 *   - Unknown slug → leave the `@slug` token unchanged (no surprise)
 *   - Email-style `me@example.com` → unchanged (require separator
 *     before `@` — same rule as AE363 currentMentionAtCursor)
 *   - Slug shape: `[a-z0-9_-]+`
 */

export interface DestinationLookupItem {
  readonly name: string;
  readonly state: string;
}

export interface DestinationLookup {
  /** Lowercased slug → {name, state}. Case-sensitive lookups should
   *  pre-lowercase their keys. */
  readonly [slug: string]: DestinationLookupItem | undefined;
}

const MENTION_RE = /(^|[^a-z0-9_-])@([a-z0-9_-]+)/gi;

export function expandMentions(text: string, lookup: DestinationLookup): string {
  if (typeof text !== 'string' || text === '') return text;
  return text.replace(MENTION_RE, (_match, prefix: string, slug: string) => {
    const dest = lookup[slug.toLowerCase()];
    if (dest === undefined) {
      // Unknown slug — leave the literal `@slug` intact.
      return `${prefix}@${slug}`;
    }
    return `${prefix}${dest.name} (${dest.state})`;
  });
}
