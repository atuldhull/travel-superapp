/**
 * Defensive coercion for the generated `TripDto` fields.
 *
 * Orval emits the `@nullable` string fields (`startsOn`, `endsOn`,
 * `archivedAt`) as a branded `string | object` union because the
 * swagger schema doesn't reify their runtime type. Every consumer
 * was either casting with `as unknown as string` (lies about the
 * runtime shape) or duplicating a `typeof v === 'string'` guard
 * inline (`home/page.tsx` pre-F4, repeated 6×; `trips/page.tsx`
 * 2× casts; `trips/[id]/page.tsx` 5× casts — that one's deferred-
 * for-review and intentionally NOT touched in F4).
 *
 * Lifted to this shared lib so /home and /trips read the same
 * `string | null` shape. Pure helpers; bad input → null.
 *
 * Installed for Phase 2 polish (F4).
 */

/**
 * Read a possibly-string TripDto field defensively. Empty string →
 * null (the SDK never emits empty for a required field, but the guard
 * keeps callers from having to write `if (s && s.length > 0)`).
 */
export function coerceTripString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * Alias for date-typed TripDto fields — same underlying guard, but
 * the explicit name communicates intent at the callsite.
 */
export const coerceTripDate = coerceTripString;

/**
 * The hub's clean local shape — id + title + the two dates as honest
 * `string | null`. The full TripDto carries owner/status/version/
 * archivedAt etc. but hub surfaces only need this slice.
 */
export interface HubTripView {
  readonly id: string;
  readonly title: string;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
}

/**
 * Coerce an unknown row (e.g. a generated TripDto with branded
 * unions) into the clean hub shape. Returns null when the row is
 * missing id or title (don't render half-built cards).
 */
export function toHubTripView(row: unknown): HubTripView | null {
  if (typeof row !== 'object' || row === null) return null;
  const o = row as Record<string, unknown>;
  const id = coerceTripString(o['id']);
  const title = coerceTripString(o['title']);
  if (!id || !title) return null;
  return {
    id,
    title,
    startsOn: coerceTripDate(o['startsOn']),
    endsOn: coerceTripDate(o['endsOn']),
  };
}
