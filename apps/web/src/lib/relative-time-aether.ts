/**
 * AE253 — pure relative-time formatter for Aether surfaces.
 *
 * Today various surfaces use a bespoke `<RelativeTime/>` component
 * or call new Date(...).toLocaleString. For static contexts (RSS
 * dates, SSR'd OG previews, share-card footers) we need a calm
 * locale-stable formatter that says:
 *
 *   < 60s     → 'just now'
 *   < 60m     → '<n>m ago'
 *   < 24h     → '<n>h ago'
 *   < 7d      → '<n>d ago'
 *   < 30d     → '<n>w ago'
 *   < 365d    → '<n>mo ago'
 *   else      → '<n>y ago'
 *
 * Future timestamps render with a 'in' prefix. Unparseable / null
 * input returns ''.
 */

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export function formatRelativeAether(
  input: string | Date | null | undefined,
  now: Date = new Date(),
): string {
  if (input === null || input === undefined) return '';
  const target = input instanceof Date ? input : new Date(input);
  const t = target.getTime();
  if (Number.isNaN(t)) return '';
  const diff = now.getTime() - t;
  const abs = Math.abs(diff);
  const sign = diff >= 0 ? 'ago' : 'from now';
  let n: number;
  let unit: string;
  if (abs < MIN) return diff >= 0 ? 'just now' : 'in a moment';
  if (abs < HOUR) {
    n = Math.floor(abs / MIN);
    unit = 'm';
  } else if (abs < DAY) {
    n = Math.floor(abs / HOUR);
    unit = 'h';
  } else if (abs < WEEK) {
    n = Math.floor(abs / DAY);
    unit = 'd';
  } else if (abs < MONTH) {
    n = Math.floor(abs / WEEK);
    unit = 'w';
  } else if (abs < YEAR) {
    n = Math.floor(abs / MONTH);
    unit = 'mo';
  } else {
    n = Math.floor(abs / YEAR);
    unit = 'y';
  }
  if (sign === 'ago') return `${n}${unit} ago`;
  return `in ${n}${unit}`;
}
