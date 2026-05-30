/**
 * AE256 — pure resolver for "what date does the trip start?".
 *
 * Two sources of truth disagree honestly:
 *   - the user's saved trip.startsOn (may be null on draft)
 *   - the first itinerary day's date (server-derived)
 *
 * Rule (most-to-least preferred):
 *   1. trip.startsOn if present
 *   2. first day.date in the itinerary (chronologically earliest)
 *   3. trip.createdAt as last resort
 *   4. null
 *
 * Pure; takes already-iso strings. The "earliest" pick over the
 * itinerary defends against an out-of-order .days array.
 */

export interface DateProvider {
  readonly date: string | null;
}

export interface FindFirstItineraryDateInputs {
  readonly tripStartsOn: string | null;
  readonly tripCreatedAt: string | null;
  readonly itineraryDays: ReadonlyArray<DateProvider>;
}

function earliestIso(days: ReadonlyArray<DateProvider>): string | null {
  let best: string | null = null;
  let bestTs = Number.POSITIVE_INFINITY;
  for (const d of days) {
    if (d.date === null) continue;
    const t = new Date(d.date).getTime();
    if (!Number.isFinite(t)) continue;
    if (t < bestTs) {
      bestTs = t;
      best = d.date;
    }
  }
  return best;
}

export function findFirstItineraryDate(inputs: FindFirstItineraryDateInputs): string | null {
  if (inputs.tripStartsOn !== null) return inputs.tripStartsOn;
  const fromItinerary = earliestIso(inputs.itineraryDays);
  if (fromItinerary !== null) return fromItinerary;
  return inputs.tripCreatedAt;
}
