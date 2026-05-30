/**
 * AE248 — pure formatter for an in-season month list.
 *
 * The destination hero subhead currently shows "In season now" iff
 * the current month is in the season set. A richer surface is to
 * render the actual list — "Best Oct → Mar" or "Open Jun-Sep".
 * This helper turns a set of 1-based month numbers into:
 *
 *   - the contiguous range "Jun–Sep" when months are consecutive
 *   - a "Mar–Sep, Nov" list when there's a gap (rare but supported)
 *   - "Year-round" when all 12 months are present
 *   - "—" when the set is empty
 *
 * Handles Dec→Jan wrap as a single "Nov–Mar" range (the calendar
 * idiom).
 *
 * Returns the formatted string. Pure, locale-agnostic (English).
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isContiguousWithWrap(months: number[]): boolean {
  if (months.length === 1) return true;
  // Sort ascending; check if all gaps are 1.
  const sorted = [...months].sort((a, b) => a - b);
  let gaps = 0;
  for (let i = 1; i < sorted.length; i++) {
    if ((sorted[i] ?? 0) - (sorted[i - 1] ?? 0) !== 1) gaps += 1;
  }
  // Wraparound is allowed: exactly one gap if it spans Dec→Jan
  // (smallest=1, largest=12, gaps count includes the wrap as 1).
  if (gaps === 0) return true;
  if (gaps === 1) {
    const hasDec = sorted.includes(12);
    const hasJan = sorted.includes(1);
    return hasDec === true && hasJan === true;
  }
  return false;
}

function formatRangeWithWrap(months: number[]): string {
  const sorted = [...months].sort((a, b) => a - b);
  const hasDec = sorted.includes(12);
  const hasJan = sorted.includes(1);
  // No wrap: simple Xxx–Yyy.
  if (!(hasDec && hasJan)) {
    const lo = sorted[0] ?? 1;
    const hi = sorted[sorted.length - 1] ?? 12;
    if (lo === hi) return MONTHS[lo - 1] ?? '';
    return `${MONTHS[lo - 1]}–${MONTHS[hi - 1]}`;
  }
  // Wrap: the "tail" is the contiguous run ending at 12, and the
  // "head" is the contiguous run starting at 1. Range is tailStart→headEnd.
  let tailStart = 12;
  for (let m = 11; m >= 1; m--) {
    if (sorted.includes(m) === false) {
      tailStart = m + 1;
      break;
    }
    tailStart = m;
  }
  let headEnd = 1;
  for (let m = 2; m <= 12; m++) {
    if (sorted.includes(m) === false) {
      headEnd = m - 1;
      break;
    }
    headEnd = m;
  }
  return `${MONTHS[tailStart - 1]}–${MONTHS[headEnd - 1]}`;
}

export function formatInSeasonMonths(months: ReadonlySet<number> | ReadonlyArray<number>): string {
  const arr = Array.from(months).filter((m) => m >= 1 && m <= 12);
  if (arr.length === 0) return '—';
  if (arr.length === 12) return 'Year-round';
  if (isContiguousWithWrap(arr)) return formatRangeWithWrap(arr);
  // Fallback: sort + list with commas.
  return [...arr]
    .sort((a, b) => a - b)
    .map((m) => MONTHS[m - 1])
    .join(', ');
}
