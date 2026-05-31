/**
 * AE301 — pure sort for itinerary days.
 *
 * The /aether/journey/[id] dashboard renders day cards in order;
 * the SDK *should* return days in chronological order but the
 * contract doesn't promise it. This helper canonicalises:
 *
 *   1. days with a parseable `date` sort chronologically ascending
 *   2. days without a date sort to the end, preserving input order
 *      (so a draft day stays after the dated ones)
 *
 * Returns a NEW array; input not mutated.
 */

export interface SortableItineraryDay {
  readonly date: string | null;
}

function tsOf(s: string | null): number | null {
  if (s === null) return null;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : null;
}

export function sortItineraryDays<D extends SortableItineraryDay>(days: ReadonlyArray<D>): D[] {
  return days
    .map((d, idx) => ({ d, idx, ts: tsOf(d.date) }))
    .sort((a, b) => {
      if (a.ts === null && b.ts === null) return a.idx - b.idx;
      if (a.ts === null) return 1;
      if (b.ts === null) return -1;
      const dt = a.ts - b.ts;
      if (dt !== 0) return dt;
      return a.idx - b.idx;
    })
    .map(({ d }) => d);
}
