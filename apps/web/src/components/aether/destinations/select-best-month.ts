/**
 * AE298 — pure "best month to visit" picker from an in-season
 * month-set.
 *
 * Powers AE293 seasonChipLabel's optional `bestMonth` enrichment:
 * given a destination's in-season Set + the current date, return
 * the month name of the next in-season month from now (inclusive).
 * For a destination ALREADY in season, that's the current month;
 * for one out of season, that's the soonest upcoming entry.
 *
 * Returns null for an empty set or all-12 (no preference signal).
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface SelectBestMonthInputs {
  readonly months: ReadonlySet<number> | ReadonlyArray<number>;
  readonly now?: Date;
}

export function selectBestMonth(inputs: SelectBestMonthInputs): string | null {
  const arr = Array.from(inputs.months).filter((m) => m >= 1 && m <= 12);
  if (arr.length === 0 || arr.length === 12) return null;
  const set = new Set(arr);
  const start = (inputs.now ?? new Date()).getMonth() + 1; // 1..12
  for (let offset = 0; offset < 12; offset++) {
    const probe = ((start - 1 + offset) % 12) + 1;
    if (set.has(probe)) return MONTHS[probe - 1] ?? null;
  }
  return null;
}
