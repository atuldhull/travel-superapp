/**
 * AE143 — pure helpers for the AE141 activity-timeline ISO-week
 * grouping. Extracted from journey-dashboard so the math (Monday
 * shift, week key, label) can be unit-tested without rendering the
 * whole dashboard.
 *
 * The renderer in journey-dashboard.tsx still owns the JSX; this file
 * only owns the deterministic grouping logic and the threshold
 * constant.
 */

/** Once events exceed this count, the timeline groups them by ISO
 *  week. Picked because a single trip rarely has more organic events
 *  than this; beyond it, group headers help the eye scan arcs. */
export const TIMELINE_GROUP_THRESHOLD = 8;

export interface TimelineEvent {
  readonly at: string;
  readonly label: string;
  readonly kind: 'create' | 'edit' | 'archive' | 'share';
}

export interface TimelineGroup<E extends TimelineEvent = TimelineEvent> {
  readonly key: string;
  readonly label: string;
  readonly items: E[];
}

/** ISO week key — yyyy-mm-dd of the Monday of the week the date
 *  falls in. Returns `'unknown'` for unparseable strings so callers
 *  don't crash on bad data. Uses local-date math so the user sees the
 *  Monday they actually lived through, not the UTC Monday — important
 *  when `toISOString()` would shift the date across the IDL. */
export function weekKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  const day = d.getDay(); // 0=Sun
  const shift = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + shift);
  monday.setHours(0, 0, 0, 0);
  // Compose YYYY-MM-DD from local fields so toISOString's UTC shift
  // doesn't drop us into the previous day.
  const yyyy = monday.getFullYear().toString().padStart(4, '0');
  const mm = (monday.getMonth() + 1).toString().padStart(2, '0');
  const dd = monday.getDate().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Human label for a date — "Week of MMM D". Bad date → raw input. */
export function weekLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `Week of ${d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })}`;
}

/** Group already-sorted events into ISO-week buckets. Each group
 *  carries the Monday key and a label sourced from the first event in
 *  the bucket (so the label tracks the calendar week boundary). */
export function groupByWeek<E extends TimelineEvent>(events: ReadonlyArray<E>): TimelineGroup<E>[] {
  const out: TimelineGroup<E>[] = [];
  let last: string | null = null;
  for (const e of events) {
    const wk = weekKey(e.at);
    if (wk !== last) {
      out.push({ key: wk, label: weekLabel(e.at), items: [] });
      last = wk;
    }
    out[out.length - 1]?.items.push(e);
  }
  return out;
}
