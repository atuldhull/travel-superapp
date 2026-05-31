/**
 * AE393 — pure helpers for the Drift Now Card's persona / upcoming-trip
 * layer.
 *
 * AE385 ships the time-of-day baseline; AE393 extends it so a user
 * with a trip starting soon sees something more specific ("3 days
 * until Leh — sketch the day-1 itinerary"). When no upcoming trip is
 * present, the helpers fall through to the AE385 content unchanged so
 * pre-onboarded sessions keep their hero feel.
 *
 * Pure — no React, no SDK. The Drift shell wires `useAetherTripList()`
 * + a context provider; this module just normalises the data and
 * decides what to say.
 */
import { nowCardContent, type NowCardContent } from './now-card-content';

/** Minimal trip shape the Now Card cares about. Matches the structural
 *  subset of `TripDto` we read from `@app/sdk`; declared locally so the
 *  helpers stay framework-/SDK-agnostic. */
export interface UpcomingTripLike {
  readonly id: string;
  readonly title: string;
  /** ISO string (orval's `TripDto.startsOn` runtime shape) or null. */
  readonly startsOn: string | null;
  /** Same convention as TripDto. */
  readonly endsOn?: string | null;
  /** Mostly read as a "skip archived" guard upstream — kept here
   *  optional so future status-aware rules can layer in. */
  readonly status?: string | null;
  /** When the trip's archived flag was set (null = not archived). */
  readonly archivedAt?: string | null;
}

/** Days from `at` until `target`. Negative if `target` is in the past.
 *  Whole-day rounding (UTC). Returns Infinity when either input is
 *  invalid so the caller can skip the personalisation cleanly. */
export function daysUntil(target: Date | string | null | undefined, at: Date | number): number {
  if (target === null || target === undefined || target === '') return Number.POSITIVE_INFINITY;
  const targetDate = target instanceof Date ? target : new Date(target);
  if (Number.isNaN(targetDate.getTime())) return Number.POSITIVE_INFINITY;
  const nowDate = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(nowDate.getTime())) return Number.POSITIVE_INFINITY;
  const ONE_DAY = 24 * 60 * 60 * 1000;
  // Round each side to UTC midnight before subtracting so 23h59m and
  // 00h01m don't flip between "0 days" and "1 day" arbitrarily.
  const t = Date.UTC(
    targetDate.getUTCFullYear(),
    targetDate.getUTCMonth(),
    targetDate.getUTCDate(),
  );
  const n = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate());
  return Math.round((t - n) / ONE_DAY);
}

/** Pick the trip with the soonest `startsOn` in the future.
 *
 *  Rules:
 *   - skip archived trips (archivedAt != null)
 *   - skip trips with no startsOn
 *   - skip trips whose startsOn is in the past
 *   - tie-break by id (stable sort guarantees deterministic pick)
 *
 *  Returns the trip, or null if no upcoming trip exists. */
export function pickUpcomingTrip(
  trips: ReadonlyArray<UpcomingTripLike>,
  now: Date | number = new Date(),
): UpcomingTripLike | null {
  const at = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(at.getTime())) return null;
  let best: UpcomingTripLike | null = null;
  let bestDays = Number.POSITIVE_INFINITY;
  for (const t of trips) {
    if (t.archivedAt !== null && t.archivedAt !== undefined && t.archivedAt !== '') continue;
    if (t.startsOn === null || t.startsOn === undefined || t.startsOn === '') continue;
    const d = daysUntil(t.startsOn, at);
    // Strict-future: today (d === 0) counts (the user might want a
    // "Trip day — open Atlas" Now Card on departure morning).
    if (d < 0 || !Number.isFinite(d)) continue;
    if (
      d < bestDays ||
      // Stable tie-break by id so a deterministic pick survives across
      // re-renders.
      (d === bestDays && best !== null && t.id < best.id)
    ) {
      best = t;
      bestDays = d;
    }
  }
  return best;
}

/** Resolve the Now Card content with optional persona / upcoming-trip
 *  layering on top of the AE385 time-of-day baseline.
 *
 *  Personalisation buckets (when an upcoming trip is provided):
 *    `d <= 0`           → "Trip day · Open the Atlas" (verb: Open)
 *    `1 <= d <= 7`      → "<N> day(s) until <title>" + "Sketch the day-1
 *                          itinerary." (verb: Sketch)
 *    `8 <= d <= 30`     → "<N> days until <title>" + "Polish the plan."
 *                          (verb: Polish)
 *    `d > 30`           → falls through to time-of-day baseline (the trip
 *                          is too far out to be the daily prompt; the
 *                          baseline keeps the surface from feeling stale)
 *    no trip / past trip → time-of-day baseline */
export function nowCardPersonalised(
  at: Date | number,
  upcomingTrip?: UpcomingTripLike | null,
): NowCardContent {
  const base = nowCardContent(at);
  if (upcomingTrip === null || upcomingTrip === undefined) return base;
  const d = daysUntil(upcomingTrip.startsOn, at);
  if (!Number.isFinite(d)) return base;
  if (d <= 0) {
    return {
      ...base,
      headline: 'Trip day',
      suggestion: `${upcomingTrip.title} starts today.`,
      verb: 'Open',
    };
  }
  if (d <= 7) {
    return {
      ...base,
      headline: `${d} day${d === 1 ? '' : 's'} until ${upcomingTrip.title}`,
      suggestion: 'Sketch the day-1 itinerary.',
      verb: 'Sketch',
    };
  }
  if (d <= 30) {
    return {
      ...base,
      headline: `${d} days until ${upcomingTrip.title}`,
      suggestion: 'Polish the plan.',
      verb: 'Polish',
    };
  }
  return base;
}
