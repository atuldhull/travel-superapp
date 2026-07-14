/**
 * Generates a trip's itinerary: one `ItineraryDay` per calendar date,
 * each with a summary written by the registered `TripPlannerPort`.
 *
 *   - Requires the trip to have both `startsOn` and `endsOn`
 *     (otherwise we don't know how many days to seed).
 *   - Creates one `ItineraryDay` per calendar date inclusive of
 *     both endpoints — a 3-day trip gets 3 days.
 *   - Day summaries come from the planner port. `trip.module.ts`
 *     resolves that port to Anthropic → Gemini → Ollama → stub in
 *     priority order, so an unprovisioned env still gets prose
 *     instead of a hard failure.
 *   - Items are placed round-robin from the Places module. The
 *     planner returns prose, not place IDs, so place selection stays
 *     a separate concern.
 *   - Idempotent at the port level: re-invocation calls
 *     `replaceDays`, wiping + re-inserting. Matches the "re-plan"
 *     mental model rather than "append".
 *
 * The planner is never allowed to fail the request: if it throws, or
 * returns nothing usable for a given day, that day falls back to a
 * deterministic summary. Generating an itinerary must keep working
 * with no LLM in the loop.
 */
import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '@app/events';
import { NotFoundError, ValidationError } from '@app/errors';
import { createLogger, getTraceContext } from '@app/logger';
import { GeoQueries } from '../../../common/db/geo-queries';
import { PLACE_REPOSITORY, type PlaceRepository } from '../../places';
import type { ItineraryDay } from '../domain/itinerary.entity';
import type { Trip } from '../domain/trip.entity';
import { makeEvent, type TripItineraryGeneratedEvent } from '../domain/trip.events';
import {
  ITINERARY_REPOSITORY,
  type CreateDayInput,
  type CreateItemInput,
  type ItineraryRepository,
} from './ports/itinerary.repository';
import {
  TRIP_PLANNER_PORT,
  type TripPlannerPort,
  type TripPlannerProvider,
} from './ports/trip-planner.port';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

const log = createLogger('trip.itinerary.generator');

export interface GenerateItineraryCommand {
  readonly tripId: string;
  readonly userId: string;
}

export interface GeneratedItinerary {
  readonly trip: Trip;
  readonly days: readonly ItineraryDay[];
  /** Which planner tier actually wrote the summaries. `null` when the
   *  planner was skipped (no trip center) or failed and every day fell
   *  back to a deterministic summary. */
  readonly provider: TripPlannerProvider | null;
}

/**
 * Max trip length we'll generate days for. Protects us from a user
 * POSTing a `startsOn`/`endsOn` pair that would create thousands of
 * rows. Realistic outer bound: a 90-day sabbatical.
 */
const MAX_TRIP_DAYS = 90;

/**
 * Target activities per day. We fetch `dayCount * this` places from
 * the Places module and distribute them round-robin. When fewer
 * places are available, days fill up partially or stay empty.
 */
const TARGET_ITEMS_PER_DAY = 3;

/** Upper bound on a persisted day summary. The planners are told to
 *  write one short paragraph per day; this only guards against a model
 *  that ignores the instruction. */
const MAX_SUMMARY_CHARS = 2_000;

@Injectable()
export class GenerateItineraryUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(ITINERARY_REPOSITORY) private readonly itinerary: ItineraryRepository,
    @Inject(PLACE_REPOSITORY) private readonly places: PlaceRepository,
    @Inject(GeoQueries) private readonly geo: GeoQueries,
    @Inject(TRIP_PLANNER_PORT) private readonly planner: TripPlannerPort,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  async execute(cmd: GenerateItineraryCommand): Promise<GeneratedItinerary> {
    const trip = await this.trips.findByIdForUser(cmd.tripId, cmd.userId);
    if (!trip) {
      // Same 404-shape as GET /trips/:id — don't leak existence
      // of other users' trips.
      throw new NotFoundError(
        `Trip not found: ${cmd.tripId}`,
        { tripId: cmd.tripId },
        'TRIP_NOT_FOUND',
      );
    }
    if (!trip.startsOn || !trip.endsOn) {
      throw new ValidationError(
        'Trip must have startsOn + endsOn before an itinerary can be generated',
        { dateRange: ['missing startsOn or endsOn'] },
        { tripId: trip.id },
        'ITINERARY_DATES_REQUIRED',
      );
    }
    const dayCount = daysInclusive(trip.startsOn, trip.endsOn);
    if (dayCount < 1) {
      // Invariant violation — Create use-case should have caught
      // this; belt for cases where the DB was tampered with.
      throw new ValidationError(
        'startsOn must be on or before endsOn',
        { dateRange: ['startsOn > endsOn'] },
        { tripId: trip.id },
        'INVALID_DATE_RANGE',
      );
    }
    if (dayCount > MAX_TRIP_DAYS) {
      throw new ValidationError(
        `Trip length exceeds the ${MAX_TRIP_DAYS}-day cap`,
        { dateRange: [`must be ≤ ${MAX_TRIP_DAYS} days`] },
        { tripId: trip.id, requested: dayCount, cap: MAX_TRIP_DAYS },
        'TRIP_TOO_LONG',
      );
    }

    // Fetch places inside the trip's radius so we can populate
    // each day's activities. The Places search has its own 50km
    // cap; the trip's radius is capped at 500km by the Create
    // use-case. Clamp the query radius at 50km — matches the
    // PlaceRepository port's own invariant, which would 422 on
    // anything larger.
    const center = await this.geo.findTripCenter(trip.id);
    const searchRadiusKm = Math.min(50, trip.radiusKm);
    const places = center
      ? await this.places.findWithinRadius({
          lat: center.lat,
          lng: center.lng,
          radiusKm: searchRadiusKm,
        })
      : [];
    const neededItems = dayCount * TARGET_ITEMS_PER_DAY;
    const pickedPlaces = places.slice(0, neededItems);

    // Day summaries come from whichever planner tier is registered.
    // No center means the planner has nothing to ground on, so we
    // skip it rather than send it a meaningless request.
    const { summaries, provider } = center
      ? await this.planSummaries(trip, center)
      : { summaries: new Map<number, string>(), provider: null };

    log.info(
      {
        tripId: trip.id,
        dayCount,
        placesAvailable: places.length,
        placesUsed: pickedPlaces.length,
        provider,
        plannedDays: summaries.size,
      },
      'itinerary_generated',
    );

    const baseDate = startOfUtcDay(trip.startsOn);
    const input: CreateDayInput[] = Array.from({ length: dayCount }, (_, i) => {
      // Round-robin distribution: item[0] → day1, item[1] → day2,
      // ..., item[dayCount] → day1 (next batch), etc. Each day
      // gets its own monotonic `position` across the batches it
      // receives.
      const items: CreateItemInput[] = [];
      for (let j = 0; j < TARGET_ITEMS_PER_DAY; j++) {
        const pickIdx = i + j * dayCount;
        const place = pickedPlaces[pickIdx];
        if (!place) break; // ran out of places.
        items.push({ position: j + 1, placeId: place.id });
      }
      const dayIndex = i + 1;
      return {
        tripId: trip.id,
        dayIndex,
        date: addDaysUtc(baseDate, i),
        summary: summaries.get(dayIndex) ?? `Day ${dayIndex} of your trip to ${trip.title}`,
        items,
      };
    });
    const days = await this.itinerary.replaceDays(trip.id, input);

    const evt: TripItineraryGeneratedEvent = makeEvent(
      'Trip.ItineraryGenerated',
      { tripId: trip.id, userId: trip.userId, dayCount: days.length },
      getTraceContext()?.traceId ? { traceId: getTraceContext()!.traceId } : {},
    );
    await this.events.publish(evt);

    return { trip, days, provider };
  }

  /**
   * Ask the planner for a plan and split it into per-day summaries.
   * A planner failure is logged and swallowed — the caller then falls
   * back to deterministic summaries, so the itinerary still lands.
   */
  private async planSummaries(
    trip: Trip,
    center: { readonly lat: number; readonly lng: number },
  ): Promise<{ summaries: Map<number, string>; provider: TripPlannerProvider | null }> {
    try {
      const result = await this.planner.generatePlan({
        title: trip.title,
        center,
        radiusKm: trip.radiusKm,
        startsOn: trip.startsOn ?? null,
        endsOn: trip.endsOn ?? null,
      });
      return { summaries: splitPlanIntoDaySummaries(result.plan), provider: result.provider };
    } catch (err) {
      log.warn(
        { tripId: trip.id, err: err instanceof Error ? err.message : String(err) },
        'itinerary_planner_failed',
      );
      return { summaries: new Map(), provider: null };
    }
  }
}

/**
 * Split a planner's prose into per-day summaries, keyed by the day
 * number the model itself wrote.
 *
 * Every adapter is prompted to emit `Day N — ...` blocks, so we key on
 * that marker rather than on paragraph position: a model that opens
 * with a preamble, or skips a day, then can't silently shift every
 * subsequent day's text onto the wrong date. Anything before the first
 * marker is dropped.
 */
export function splitPlanIntoDaySummaries(plan: string): Map<number, string> {
  const summaries = new Map<number, string>();
  let current: number | null = null;
  let buffer: string[] = [];

  const flush = (): void => {
    if (current === null) return;
    const text = buffer.join('\n').trim();
    if (text.length > 0 && !summaries.has(current)) {
      summaries.set(current, text.slice(0, MAX_SUMMARY_CHARS));
    }
    buffer = [];
  };

  for (const line of plan.split('\n')) {
    const marker = /^\s*Day\s+(\d+)\b/i.exec(line);
    if (marker) {
      flush();
      current = Number(marker[1]);
    }
    if (current !== null) {
      buffer.push(line.trim());
    }
  }
  flush();
  return summaries;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDaysUtc(base: Date, days: number): Date {
  const result = new Date(base.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function daysInclusive(start: Date, end: Date): number {
  const a = startOfUtcDay(start).getTime();
  const b = startOfUtcDay(end).getTime();
  const diffDays = Math.round((b - a) / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}
