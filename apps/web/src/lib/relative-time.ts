/**
 * POST.8 — Tiny relative-time formatter. Hand-rolled instead of
 * pulling in `date-fns` (~30 KB) — the legal copy doesn't need
 * locale-aware pluralisation; English-only is the right v1 trade-off.
 *
 * Returns one of:
 *   - `just now`               (< 60 sec)
 *   - `<n> minutes ago`        (1-59 min)
 *   - `<n> hours ago`          (1-23 h)
 *   - `<n> days ago`           (1-29 d)
 *   - absolute date (Jan 15)   (≥ 30 d, current year)
 *   - absolute (Jan 15, 2024)  (≥ 30 d, prior year)
 *
 * Future dates collapse to `in <n> ...` with the same buckets.
 *
 * Pure function — `now` parameter for deterministic tests.
 */
const MIN_MS = 60 * 1000;
const HOUR_MS = 60 * MIN_MS;
const DAY_MS = 24 * HOUR_MS;

export function formatRelativeTime(at: Date | string | number, now: Date = new Date()): string {
  const then = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(then.getTime())) return 'unknown';
  const diffMs = now.getTime() - then.getTime();
  const future = diffMs < 0;
  const abs = Math.abs(diffMs);
  if (abs < MIN_MS) return 'just now';
  if (abs < HOUR_MS) {
    const m = Math.round(abs / MIN_MS);
    return future ? `in ${m} minute${m === 1 ? '' : 's'}` : `${m} minute${m === 1 ? '' : 's'} ago`;
  }
  if (abs < DAY_MS) {
    const h = Math.round(abs / HOUR_MS);
    return future ? `in ${h} hour${h === 1 ? '' : 's'}` : `${h} hour${h === 1 ? '' : 's'} ago`;
  }
  if (abs < 30 * DAY_MS) {
    const d = Math.round(abs / DAY_MS);
    return future ? `in ${d} day${d === 1 ? '' : 's'}` : `${d} day${d === 1 ? '' : 's'} ago`;
  }
  // Beyond 30 days — fall back to absolute date. Drop the year
  // when it's the current calendar year (less visual noise).
  const opts: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    ...(then.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  };
  return then.toLocaleDateString(undefined, opts);
}
