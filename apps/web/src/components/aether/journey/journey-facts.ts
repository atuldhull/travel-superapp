/**
 * AE214 — pure builder for the journey-dashboard facts-strip rows.
 *
 * The 4-cell facts strip (Range · Days · Radius · Drafted) used to
 * be inlined as an array literal mixing local fmtDate / daysBetween
 * calls. This helper builds the same {label, value} list from a
 * structural trip slice, using the shared aether-dates locale helpers.
 *
 * The em-dash em "—" is the canonical placeholder for any missing
 * date so the strip stays a uniform 4 cells even on bare drafts.
 */
import { fmtDate, inclusiveDaysBetween } from '../../../lib/aether-dates';

export interface JourneyFactsInputs {
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly radiusKm: number;
  readonly createdAt: string | null;
}

export interface JourneyFact {
  readonly label: string;
  readonly value: string;
}

const DASH = '—';

export function buildJourneyFacts(trip: JourneyFactsInputs): JourneyFact[] {
  const range =
    trip.startsOn !== null && trip.endsOn !== null
      ? `${fmtDate(trip.startsOn)} – ${fmtDate(trip.endsOn)}`
      : DASH;
  const incl = inclusiveDaysBetween(trip.startsOn, trip.endsOn);
  const days = incl !== null ? String(incl) : DASH;
  return [
    { label: 'Range', value: range },
    { label: 'Days', value: days },
    { label: 'Radius', value: `${trip.radiusKm}km` },
    { label: 'Drafted', value: fmtDate(trip.createdAt) },
  ];
}
