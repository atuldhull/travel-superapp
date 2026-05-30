/**
 * AE280 — pure recent-activity summary line for the /me aggregate.
 *
 * Today the /me dashboard surfaces a discrete "Recent" tile. As
 * the trips list grows we want a one-liner like:
 *   "Edited Goa shores 2h ago"
 *   "Drafted Leh winter trip · just now"
 *
 * This helper picks the trip with the most-recent updatedAt or
 * createdAt (whichever is later) and uses AE253 formatRelativeAether
 * for the time fragment. Returns null when there's nothing recent.
 */
import { formatRelativeAether } from '../../../lib/relative-time-aether';

export interface RecentActivityCandidate {
  readonly title: string;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
  readonly archivedAt?: string | null;
}

export interface RecentActivitySummary {
  readonly verb: 'Edited' | 'Drafted' | 'Archived';
  readonly title: string;
  readonly when: string;
  readonly line: string;
}

function tsOf(iso: string | null | undefined): number {
  if (iso === null || iso === undefined || iso === '') return Number.NEGATIVE_INFINITY;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
}

export function summariseRecentActivity(
  trips: ReadonlyArray<RecentActivityCandidate>,
  now: Date = new Date(),
): RecentActivitySummary | null {
  if (trips.length === 0) return null;
  let bestTs = Number.NEGATIVE_INFINITY;
  let bestTrip: RecentActivityCandidate | null = null;
  let bestVerb: RecentActivitySummary['verb'] = 'Drafted';
  let bestWhen = '';
  for (const t of trips) {
    const created = tsOf(t.createdAt);
    const updated = tsOf(t.updatedAt);
    const archived = tsOf(t.archivedAt);
    const candidates: Array<{ ts: number; verb: RecentActivitySummary['verb']; iso: string }> = [];
    if (created !== Number.NEGATIVE_INFINITY) {
      candidates.push({ ts: created, verb: 'Drafted', iso: t.createdAt ?? '' });
    }
    if (updated !== Number.NEGATIVE_INFINITY && updated !== created) {
      candidates.push({ ts: updated, verb: 'Edited', iso: t.updatedAt ?? '' });
    }
    if (archived !== Number.NEGATIVE_INFINITY) {
      candidates.push({ ts: archived, verb: 'Archived', iso: t.archivedAt ?? '' });
    }
    for (const c of candidates) {
      if (c.ts > bestTs) {
        bestTs = c.ts;
        bestTrip = t;
        bestVerb = c.verb;
        bestWhen = c.iso;
      }
    }
  }
  if (bestTrip === null) return null;
  const when = formatRelativeAether(bestWhen, now);
  return {
    verb: bestVerb,
    title: bestTrip.title,
    when,
    line: `${bestVerb} ${bestTrip.title} · ${when}`,
  };
}
