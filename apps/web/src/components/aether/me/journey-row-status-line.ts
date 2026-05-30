/**
 * AE234 — pure builder for the /me/journeys row status line.
 *
 * The row says e.g. "Active · 5 days · 3 shares" or "Draft · 0 shares".
 * Today these are assembled with several inline ternaries. This
 * helper canonicalises:
 *
 *   buildJourneyRowStatusLine({ status, days, shareCount, inSeasonOf? })
 *     → string (segments joined by ' · ', empties dropped)
 *
 * Uses AE223 pluralise + AE217 deriveTripStatus naming so the
 * surfaces stay consistent.
 */
import { countLabel } from '../../../lib/pluralise';
import type { TripStatus } from '../journey/derive-trip-status';

const STATUS_LABEL: Record<TripStatus, string> = {
  draft: 'Draft',
  upcoming: 'Upcoming',
  active: 'Active',
  past: 'Past',
  archived: 'Archived',
};

export interface JourneyRowStatusLineInputs {
  readonly status: TripStatus;
  readonly days: number | null;
  readonly shareCount: number;
  /** AE107 — when the trip title matches an in-season destination,
   *  this is its display name. */
  readonly inSeasonOf?: string | null;
}

export function buildJourneyRowStatusLine(inputs: JourneyRowStatusLineInputs): string {
  const segments: string[] = [STATUS_LABEL[inputs.status]];
  if (inputs.days !== null && inputs.days > 0) segments.push(countLabel(inputs.days, 'day'));
  segments.push(countLabel(inputs.shareCount, 'share'));
  if (inputs.inSeasonOf !== null && inputs.inSeasonOf !== undefined && inputs.inSeasonOf !== '') {
    segments.push(`${inputs.inSeasonOf} in season`);
  }
  return segments.join(' · ');
}
