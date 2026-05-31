/**
 * AE341 — pure day-of-year helper.
 *
 * Used as a deterministic rotation seed in:
 *   • AE263 pickFeaturedDestination (daily Featured card)
 *   • AE299 makeRng callers (e.g. seeded daily shuffles)
 *
 * Returns an integer in [1, 366] for valid dates (366 only on leap
 * years' Dec 31). Uses local-date math — the "day" is what the
 * device's calendar shows, not the UTC day. This is what users
 * expect: a "daily" feature changes at THEIR midnight, not the
 * server's.
 *
 * Returns 0 for invalid dates so callers can use it as a fallback
 * seed without an extra null check.
 */

const MS_PER_DAY = 86_400_000;

export function dayOfYear(d: Date): number {
  const t = d.getTime();
  if (Number.isNaN(t)) return 0;
  // Anchor at Dec 31 of the previous year (00:00 local). The diff
  // in days from that anchor gives 1 on Jan 1 — the standard "day
  // 1 of 365" interpretation.
  const anchor = new Date(d.getFullYear(), 0, 0);
  const diffMs = t - anchor.getTime();
  return Math.floor(diffMs / MS_PER_DAY);
}
