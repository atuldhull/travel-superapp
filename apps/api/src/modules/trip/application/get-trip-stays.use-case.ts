/**
 * Fetch stays near the trip's center for the trip's date range.
 * Mirrors `GetTripWeatherUseCase`'s shape — same owner gate, same
 * PostGIS `center` read via `GeoQueries`, same "import the other
 * module's use-case rather than its port" composition pattern.
 *
 * Trip dates are required: a stay search without `checkIn`/`checkOut`
 * is meaningless (availability is date-scoped). Missing dates →
 * `TRIP_DATES_REQUIRED` (422). Clients must PATCH the trip with
 * dates before calling this endpoint.
 *
 * Radius: `StaysSearch` caps at 50km but `Trip.radiusKm` can reach
 * 500km. We clamp so a long-range trip's stay search stays
 * meaningful (and inside the `SearchStaysUseCase`'s own domain
 * invariant).
 *
 * Installed by prompt [IV.18.6.2].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError, ValidationError } from '@app/errors';
import { GeoQueries } from '../../../common/db/geo-queries';
import { SearchStaysUseCase } from '../../stays/application/search-stays.use-case';
import type { StayListing } from '../../stays/domain/stay-listing.entity';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

const STAY_SEARCH_MAX_RADIUS_KM = 50;

export interface GetTripStaysCommand {
  readonly tripId: string;
  readonly userId: string;
  readonly guests?: number;
}

@Injectable()
export class GetTripStaysUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(GeoQueries) private readonly geo: GeoQueries,
    @Inject(SearchStaysUseCase) private readonly searchStays: SearchStaysUseCase,
  ) {}

  async execute(cmd: GetTripStaysCommand): Promise<readonly StayListing[]> {
    const trip = await this.trips.findByIdForUser(cmd.tripId, cmd.userId);
    if (!trip) {
      throw new NotFoundError(
        `Trip not found: ${cmd.tripId}`,
        { tripId: cmd.tripId },
        'TRIP_NOT_FOUND',
      );
    }
    if (!trip.startsOn || !trip.endsOn) {
      throw new ValidationError(
        'Trip must have startsOn and endsOn set before searching stays',
        { trip: ['startsOn and endsOn required for stay search'] },
        { tripId: trip.id },
        'TRIP_DATES_REQUIRED',
      );
    }

    const center = await this.geo.findTripCenter(trip.id);
    if (!center) {
      // Invariant violation (direct SQL tampering only). Collapse to
      // the same 404 the caller already understands.
      throw new NotFoundError(
        `Trip not found: ${cmd.tripId}`,
        { tripId: cmd.tripId },
        'TRIP_NOT_FOUND',
      );
    }

    return this.searchStays.execute({
      lat: center.lat,
      lng: center.lng,
      radiusKm: Math.min(STAY_SEARCH_MAX_RADIUS_KM, trip.radiusKm),
      checkIn: isoDate(trip.startsOn),
      checkOut: isoDate(trip.endsOn),
      ...(cmd.guests !== undefined ? { guests: cmd.guests } : {}),
    });
  }
}

function isoDate(d: Date): string {
  // YYYY-MM-DD; StaysSearch's Zod DTO enforces this exact shape.
  return d.toISOString().slice(0, 10);
}
