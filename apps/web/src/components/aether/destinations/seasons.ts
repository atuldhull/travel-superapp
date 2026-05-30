/**
 * Per-destination "is this place in season right now?" heuristic (AE83).
 *
 * Phase 0: a curated month-range map per slug. Each entry is a Set of
 * 1-based month numbers (Jan = 1) when the destination is *in*
 * season — pleasant weather, festivals on, prices kind, not blocked
 * by monsoon / heat.
 *
 * Phase 1 swaps to a server-side computation that reads the place's
 * real climate + festival calendar. Until then the curated values
 * surface as a small chip on each destination card and on the slug
 * page hero ("In season · Mar 2026").
 */

const Y = (...months: ReadonlyArray<number>): ReadonlySet<number> => new Set(months);

const SEASONS: Record<string, ReadonlySet<number>> = {
  // Rajasthan winter — Oct → Mar pleasant; Apr-Jun brutal heat;
  // Jul-Sep monsoon.
  jaipur: Y(10, 11, 12, 1, 2, 3),
  udaipur: Y(10, 11, 12, 1, 2, 3),
  // Kerala backwaters — best Dec-Mar; monsoon Jun-Aug; ok Sep-Nov.
  alleppey: Y(12, 1, 2, 3),
  // Ladakh — only the open window: Jun → Sep (high passes shut Oct-May).
  leh: Y(6, 7, 8, 9),
  // Spiti — Jun → Sep open; monsoon shadow makes Jul-Aug feasible too.
  spiti: Y(6, 7, 8, 9, 10),
  // Goa — Nov-Mar peak; monsoon Jun-Sep; April-May humid + hot.
  anjuna: Y(11, 12, 1, 2, 3),
  // Hampi — Oct-Mar; brutal heat Apr-May; ok in monsoon if you can
  // handle wet stone.
  hampi: Y(10, 11, 12, 1, 2, 3),
  // Varanasi — Oct-Mar (foggy in Dec-Jan but mystical); avoid May-Jun.
  varanasi: Y(10, 11, 12, 1, 2, 3),
  // Mumbai — Nov-Feb cool + dry; monsoon Jun-Sep glorious for some.
  mumbai: Y(11, 12, 1, 2),
  // Coorg — Oct-Mar pleasant; second monsoon makes Jun-Sep lush; ok
  // year-round if you don't mind rain.
  coorg: Y(10, 11, 12, 1, 2, 3, 9),
  // Pondicherry — Oct-Mar; cyclones Oct-Nov possible.
  pondicherry: Y(11, 12, 1, 2, 3),
  // Darjeeling — Mar-May (rhododendron) + Sep-Nov (views); monsoon
  // Jul-Aug blocks Kanchenjunga.
  darjeeling: Y(3, 4, 5, 9, 10, 11),
  // Madurai — Oct-Mar bearable; brutal Apr-Jun.
  madurai: Y(11, 12, 1, 2, 3),
  // Bhuj / Rann — Oct-Mar (Rann Utsav peak Dec-Feb); monsoon
  // covers the salt flats Jun-Sep.
  bhuj: Y(11, 12, 1, 2, 3),
  // Shillong — year-round mild; peak Sep-Nov dry; Jul-Sep monsoon
  // is the gorgeous version of the place too.
  shillong: Y(3, 4, 5, 9, 10, 11),
};

/** Is the destination in season this month? */
export function isInSeason(slug: string, now: Date = new Date()): boolean {
  const month = now.getMonth() + 1;
  const set = SEASONS[slug];
  return set !== undefined && set.has(month);
}

/** All destination slugs that are in season this month. */
export function inSeasonSlugs(now: Date = new Date()): string[] {
  const month = now.getMonth() + 1;
  return Object.entries(SEASONS)
    .filter(([, set]) => set.has(month))
    .map(([slug]) => slug);
}

/** Short label for a destination's current season state. */
export function seasonLabel(slug: string, now: Date = new Date()): string {
  return isInSeason(slug, now) ? 'In season now' : 'Off-peak';
}
