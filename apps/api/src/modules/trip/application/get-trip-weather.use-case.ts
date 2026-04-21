/**
 * Fetch a weather forecast for the trip's center coordinate.
 *
 * Day count policy:
 *   - Both `startsOn` and `endsOn` set → match the trip's duration
 *     (`daysInclusive`), capped at Open-Meteo's 16-day ceiling.
 *   - One or both missing → default to 7 days (Open-Meteo's usable
 *     short-range).
 *
 * Open-Meteo always returns "from today" — the forecast isn't trip-
 * date-specific. Callers align the returned ISO dates with the
 * trip's date range client-side; the domain intentionally stays
 * agnostic to presentation.
 *
 * Ownership gate via `TripRepository.findByIdForUser` — missing trip
 * OR wrong owner collapse to 404 `TRIP_NOT_FOUND`, same as every
 * other Trip read surface.
 *
 * Installed by prompt [IV.18.5.3].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { GeoQueries } from '../../../common/db/geo-queries';
import { GetForecastUseCase } from '../../weather/application/get-forecast.use-case';
import type { WeatherForecast } from '../../weather/domain/weather-forecast.entity';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';
import { daysInclusive } from './generate-itinerary-stub.use-case';

const DEFAULT_DAYS = 7;
const MAX_DAYS = 16;

@Injectable()
export class GetTripWeatherUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(GeoQueries) private readonly geo: GeoQueries,
    @Inject(GetForecastUseCase) private readonly getForecast: GetForecastUseCase,
  ) {}

  async execute(tripId: string, userId: string): Promise<WeatherForecast> {
    const trip = await this.trips.findByIdForUser(tripId, userId);
    if (!trip) {
      throw new NotFoundError(`Trip not found: ${tripId}`, { tripId }, 'TRIP_NOT_FOUND');
    }

    const center = await this.geo.findTripCenter(trip.id);
    if (!center) {
      // Trip row exists but the PostGIS column is missing — invariant
      // violation (only possible via direct SQL tampering). Surface
      // as the same 404 the caller already understands.
      throw new NotFoundError(`Trip not found: ${tripId}`, { tripId }, 'TRIP_NOT_FOUND');
    }

    const days =
      trip.startsOn && trip.endsOn
        ? Math.max(1, Math.min(MAX_DAYS, daysInclusive(trip.startsOn, trip.endsOn)))
        : DEFAULT_DAYS;

    return this.getForecast.execute({ lat: center.lat, lng: center.lng, days });
  }
}
