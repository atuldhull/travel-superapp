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
import { NotFoundError, ValidationError } from '@app/errors';
import type { ItineraryDay } from '../domain/itinerary.entity';
import type { Trip } from '../domain/trip.entity';
import { ITINERARY_REPOSITORY, type ItineraryRepository } from './ports/itinerary.repository';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

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

@Injectable()
export class GenerateItineraryStubUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(ITINERARY_REPOSITORY) private readonly itinerary: ItineraryRepository,
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

    const baseDate = startOfUtcDay(trip.startsOn);
    const input = Array.from({ length: dayCount }, (_, i) => ({
      tripId: trip.id,
      dayIndex: i + 1,
      date: addDaysUtc(baseDate, i),
      summary: `Day ${i + 1} of your trip to ${trip.title}`,
    }));
    const days = await this.itinerary.replaceDays(trip.id, input);
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

function daysInclusive(start: Date, end: Date): number {
  const a = startOfUtcDay(start).getTime();
  const b = startOfUtcDay(end).getTime();
  const diffDays = Math.round((b - a) / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}
