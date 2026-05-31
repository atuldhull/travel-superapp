/**
 * AE338 — pure builder for the journey-dashboard activity timeline.
 *
 * Lifted from the inline IIFE that derived a TimelineEvent[] from a
 * TripDto + tripShares list. Centralising lets unit tests lock the
 * 4 contract points:
 *   1. createdAt → "Drafted"
 *   2. updatedAt → "Edited — version N" (suppressed when ===createdAt)
 *   3. archivedAt → "Archived"
 *   4. one event per share, with a code fragment in the label
 *   ordered ascending by .at.
 *
 * Inputs are structurally typed (NOT TripDto / TripShareOwnerDto) so
 * the helper compiles cleanly without pulling sdk types into the
 * helper module.
 */
import type { TimelineEvent } from './timeline-grouping';

export interface BuildTimelineTripInputs {
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
  readonly archivedAt: string | null;
  readonly version: number | null;
}

export interface BuildTimelineShareInputs {
  readonly createdAt: string | null;
  readonly shareCode: string;
}

export interface BuildTimelineEventsInputs {
  readonly trip: BuildTimelineTripInputs;
  readonly shares: ReadonlyArray<BuildTimelineShareInputs>;
}

export function buildTimelineEvents(inputs: BuildTimelineEventsInputs): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const { createdAt, updatedAt, archivedAt, version } = inputs.trip;

  if (createdAt !== null) {
    events.push({ at: createdAt, label: 'Drafted', kind: 'create' });
  }
  if (updatedAt !== null && updatedAt !== createdAt) {
    const versionLabel = version !== null ? ` — version ${version}` : '';
    events.push({ at: updatedAt, label: `Edited${versionLabel}`, kind: 'edit' });
  }
  if (archivedAt !== null) {
    events.push({ at: archivedAt, label: 'Archived', kind: 'archive' });
  }
  for (const share of inputs.shares) {
    if (share.createdAt === null) continue;
    const codeFrag = share.shareCode.slice(0, 6);
    events.push({
      at: share.createdAt,
      label: `Shared a link · ${codeFrag}…`,
      kind: 'share',
    });
  }
  // Stable ascending sort by .at — chronological reads top-down.
  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return events;
}
