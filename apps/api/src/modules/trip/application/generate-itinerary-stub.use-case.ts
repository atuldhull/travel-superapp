/**
 * Deterministic itinerary skeleton — the real AI-backed orchestrator
 * lands in its own prompt once `ai-service` is live. Today's stub:
 *
 *   - Requires the trip to have both `startsOn` and `endsOn`
 *     (otherwise we don't know how many days to seed).
 *   - Creates one `ItineraryDay` per calendar date inclusive of
 *     both endpoints — a 3-day trip gets 3 days.
 *   - No items yet. Empty `day.items`. The Places module prompt
 *     will generate item placeholders.
 *   - Summary is a descriptive stub: `"Day N of your trip to
 *     <title>"` — replaced when the AI use-case takes over.
 *   - Idempotent at the port level: re-invocation calls
 *     `replaceDays`, wiping + re-inserting. Matches the "re-plan"
 *     mental model rather than "append".
 *
 * Scope-locked: does NOT try to split the radius, pick places, or
 * reason about transport. That's the AI's job.
 *
 * Installed by prompt [IV.18.2.4].
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
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

const log = createLogger('trip.itinerary.generator');

export interface GenerateItineraryStubCommand {
  readonly tripId: string;
  readonly userId: string;
}

export interface GeneratedItinerary {
  readonly trip: Trip;
  readonly days: readonly ItineraryDay[];
}

/**
 * Max trip length we'll generate days for. Protects us from a user
 * POSTing a `startsOn`/`endsOn` pair that would create thousands of
 * rows. Realistic outer bound: a 90-day sabbatical.
 */
const MAX_TRIP_DAYS = 90;

/**
 * Target activities per day. The stub fetches `MAX_TRIP_DAYS * this`
 * places from the Places module and distributes them round-robin.
 * When fewer places are available, days fill up partially or stay
 * empty. A real AI orchestrator will override this with semantic
 * grouping (morning hike + lunch + afternoon museum …).
 */
const TARGET_ITEMS_PER_DAY = 3;

@Injectable()
export class GenerateItineraryStubUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(ITINERARY_REPOSITORY) private readonly itinerary: ItineraryRepository,
    @Inject(PLACE_REPOSITORY) private readonly places: PlaceRepository,
    @Inject(GeoQueries) private readonly geo: GeoQueries,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  async execute(cmd: GenerateItineraryStubCommand): Promise<GeneratedItinerary> {
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
    // use-case, but searching 500km of activities is pointless
    // for a stub. Clamp the query radius at 50km — matches the
    // PlaceRepository port's own invariant, which would 422 on
    // anything larger. The AI orchestrator will take a different
    // approach (semantic scoring + trip-shape awareness).
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
    log.info(
      {
        tripId: trip.id,
        dayCount,
        placesAvailable: places.length,
        placesUsed: pickedPlaces.length,
      },
      'itinerary_stub_places_picked',
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
      return {
        tripId: trip.id,
        dayIndex: i + 1,
        date: addDaysUtc(baseDate, i),
        summary: `Day ${i + 1} of your trip to ${trip.title}`,
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

    return { trip, days };
  }
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
