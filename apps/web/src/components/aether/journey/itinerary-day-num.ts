/**
 * AE239 — pure derivation of the "Day N" label + anchor id from
 * an itinerary item's position.
 *
 * journey-dashboard renders each day card with a sticky "Day N"
 * header and a #day-<id> anchor so the AE87 days-timeline bar can
 * jump to it. The math is "index + 1" — but the canonical form
 * needs to be one place so a future "start at Day 0" or "named day"
 * change lands consistently.
 *
 * Pure: no DOM access. The `dayId` is the stable trip-id-prefixed
 * anchor; pass tripId or fall back to a numeric anchor.
 */

export interface ItineraryDayLabel {
  readonly num: number;
  readonly label: string;
  readonly anchorId: string;
}

export function itineraryDayLabel(index: number, tripId: string | null = null): ItineraryDayLabel {
  const num = index + 1;
  const label = `Day ${num}`;
  const idBase = tripId === null || tripId === '' ? `${num}` : `${tripId}-${num}`;
  return { num, label, anchorId: `day-${idBase}` };
}
