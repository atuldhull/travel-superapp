/**
 * Phase 3 (G4) — Living Trip date-shift.
 *
 * When the user moves the trip's startsOn forward by N days, the
 * existing itinerary's day dates would otherwise be stranded on the
 * old calendar. This use-case slides every day by the same delta in
 * a single transaction.
 *
 * Owner-gated through `TripRepository.findByIdForUser`. Out-of-range
 * deltas (|delta| > 365 days) reject as 422 INVALID_INPUT so a
 * runaway client can't accidentally turn a 3-day trip into a
 * 30-year shift.
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError, ValidationError } from '@app/errors';
import { ITINERARY_REPOSITORY, type ItineraryRepository } from './ports/itinerary.repository';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

const MAX_DELTA_DAYS = 365;

@Injectable()
export class ShiftItineraryDatesUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(ITINERARY_REPOSITORY) private readonly itinerary: ItineraryRepository,
  ) {}

  async execute(tripId: string, userId: string, deltaDays: number): Promise<{ shifted: number }> {
    if (!Number.isInteger(deltaDays)) {
      throw new ValidationError(
        'deltaDays must be a whole-number integer',
        { deltaDays: ['must be a whole-number integer'] },
        { deltaDays },
        'INVALID_INPUT',
      );
    }
    if (Math.abs(deltaDays) > MAX_DELTA_DAYS) {
      throw new ValidationError(
        `deltaDays out of range (|delta| > ${MAX_DELTA_DAYS})`,
        { deltaDays: [`must be between -${MAX_DELTA_DAYS} and ${MAX_DELTA_DAYS}`] },
        { deltaDays, max: MAX_DELTA_DAYS },
        'INVALID_INPUT',
      );
    }
    const trip = await this.trips.findByIdForUser(tripId, userId);
    if (!trip) {
      throw new NotFoundError(`Trip not found: ${tripId}`, { tripId }, 'TRIP_NOT_FOUND');
    }
    if (deltaDays === 0) return { shifted: 0 };
    const shifted = await this.itinerary.shiftDayDates(trip.id, deltaDays);
    return { shifted };
  }
}
