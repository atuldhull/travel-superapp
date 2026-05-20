/**
 * Tiny owner-gated read for a trip's PostGIS center.
 *
 * Phase 2 polish (F2): D5's "Plan with AI" button on /home previously
 * harvested the center from the D4 weather forecast's `lat`/`lng` —
 * which silently disappeared when Open-Meteo was down. This is the
 * dedicated single-purpose route so the button no longer piggy-backs
 * on the weather subsection.
 *
 * Mirrors the existing thin-read pattern (e.g. `GetTripWeatherUseCase`):
 * owner gate via `TripRepository.findByIdForUser` → 404
 * `TRIP_NOT_FOUND`; PostGIS `center` invariant missing → same 404
 * (only reachable via direct SQL tampering).
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { GeoQueries } from '../../../common/db/geo-queries';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

export interface TripCenter {
  readonly lat: number;
  readonly lng: number;
}

@Injectable()
export class GetTripCenterUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(GeoQueries) private readonly geo: GeoQueries,
  ) {}

  async execute(tripId: string, userId: string): Promise<TripCenter> {
    const trip = await this.trips.findByIdForUser(tripId, userId);
    if (!trip) {
      throw new NotFoundError(`Trip not found: ${tripId}`, { tripId }, 'TRIP_NOT_FOUND');
    }
    const center = await this.geo.findTripCenter(trip.id);
    if (!center) {
      throw new NotFoundError(`Trip not found: ${tripId}`, { tripId }, 'TRIP_NOT_FOUND');
    }
    return { lat: center.lat, lng: center.lng };
  }
}
