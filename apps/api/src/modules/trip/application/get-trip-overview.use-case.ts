/**
 * Bundle one trip's metadata + itinerary + weather + stays + eateries
 * into a single response so a mobile client can render the "trip
 * home" screen with one round-trip instead of four.
 *
 * Error policy: **graceful per-section degradation.** Each sub-fetch
 * is wrapped so a failure (dead provider, missing trip dates for
 * stays, etc.) surfaces as `{ ok: false, code }` on that section
 * alone — the rest of the response still arrives. A dashboard that
 * 500s because one widget failed is a worse UX than a dashboard with
 * a greyed-out widget.
 *
 * Composition calls the **inner** sibling use-cases
 * (`GetForecastUseCase`, `SearchStaysUseCase`, `SearchEateriesUseCase`,
 * `ListItineraryUseCase`) directly — not the Trip × *  wrapper
 * use-cases — because we're already doing the owner gate once here.
 * Wrapper reuse would duplicate the gate and the `findTripCenter`
 * call 3+ times.
 *
 * Installed by prompt [IV.18.7.3].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { GeoQueries } from '../../../common/db/geo-queries';
import { SearchEventsUseCase } from '../../events/application/search-events.use-case';
import type { EventListing } from '../../events/domain/event-listing.entity';
import { SearchEateriesUseCase } from '../../food/application/search-eateries.use-case';
import type { EateryListing } from '../../food/domain/eatery-listing.entity';
import { SearchStaysUseCase } from '../../stays/application/search-stays.use-case';
import type { StayListing } from '../../stays/domain/stay-listing.entity';
import { GetForecastUseCase } from '../../weather/application/get-forecast.use-case';
import type { WeatherForecast } from '../../weather/domain/weather-forecast.entity';
import type { ItineraryDay } from '../domain/itinerary.entity';
import type { Trip } from '../domain/trip.entity';
import { daysInclusive } from './generate-itinerary-stub.use-case';
import { GetTripTransportLegsUseCase, type TransportLeg } from './get-trip-transport-legs.use-case';
import { ITINERARY_REPOSITORY, type ItineraryRepository } from './ports/itinerary.repository';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

const WEATHER_MAX_DAYS = 16;
const STAYS_MAX_RADIUS_KM = 50;
const EATERIES_MAX_RADIUS_KM = 25;
const EVENTS_MAX_RADIUS_KM = 30;

export type Section<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly code: string };

export interface TripOverview {
  readonly trip: Trip;
  readonly itinerary: Section<readonly ItineraryDay[]>;
  readonly weather: Section<WeatherForecast>;
  readonly stays: Section<readonly StayListing[]>;
  readonly eateries: Section<readonly EateryListing[]>;
  readonly events: Section<readonly EventListing[]>;
  readonly transport: Section<readonly TransportLeg[]>;
}

@Injectable()
export class GetTripOverviewUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(ITINERARY_REPOSITORY) private readonly itinerary: ItineraryRepository,
    @Inject(GeoQueries) private readonly geo: GeoQueries,
    @Inject(GetForecastUseCase) private readonly getForecast: GetForecastUseCase,
    @Inject(SearchStaysUseCase) private readonly searchStays: SearchStaysUseCase,
    @Inject(SearchEateriesUseCase) private readonly searchEateries: SearchEateriesUseCase,
    @Inject(SearchEventsUseCase) private readonly searchEvents: SearchEventsUseCase,
    @Inject(GetTripTransportLegsUseCase)
    private readonly transportLegs: GetTripTransportLegsUseCase,
  ) {}

  async execute(tripId: string, userId: string): Promise<TripOverview> {
    const trip = await this.trips.findByIdForUser(tripId, userId);
    if (!trip) {
      throw new NotFoundError(`Trip not found: ${tripId}`, { tripId }, 'TRIP_NOT_FOUND');
    }
    const center = await this.geo.findTripCenter(trip.id);
    if (!center) {
      throw new NotFoundError(`Trip not found: ${tripId}`, { tripId }, 'TRIP_NOT_FOUND');
    }

    const weatherDays =
      trip.startsOn && trip.endsOn
        ? Math.max(1, Math.min(WEATHER_MAX_DAYS, daysInclusive(trip.startsOn, trip.endsOn)))
        : 7;

    // Run the six sub-fetches concurrently. Each is wrapped so a
    // single failure doesn't reject the whole bundle.
    const [itinerary, weather, stays, eateries, events, transport] = await Promise.all([
      section(() => this.itinerary.listDays(trip.id)),
      section(() =>
        this.getForecast.execute({ lat: center.lat, lng: center.lng, days: weatherDays }),
      ),
      section(async () => {
        if (!trip.startsOn || !trip.endsOn) {
          throw new GracefulSkip('TRIP_DATES_REQUIRED');
        }
        return this.searchStays.execute({
          lat: center.lat,
          lng: center.lng,
          radiusKm: Math.min(STAYS_MAX_RADIUS_KM, trip.radiusKm),
          checkIn: trip.startsOn.toISOString().slice(0, 10),
          checkOut: trip.endsOn.toISOString().slice(0, 10),
          guests: 1,
        });
      }),
      section(() =>
        this.searchEateries.execute({
          lat: center.lat,
          lng: center.lng,
          radiusKm: Math.min(EATERIES_MAX_RADIUS_KM, trip.radiusKm),
        }),
      ),
      section(async () => {
        if (!trip.startsOn || !trip.endsOn) {
          throw new GracefulSkip('TRIP_DATES_REQUIRED');
        }
        // Full-day window bounds — events at 11pm on the last day
        // still match. Matches the Trip × Events fold-in's approach.
        const endExclusive = new Date(trip.endsOn.getTime() + 24 * 60 * 60 * 1000 - 1);
        return this.searchEvents.execute({
          lat: center.lat,
          lng: center.lng,
          radiusKm: Math.min(EVENTS_MAX_RADIUS_KM, trip.radiusKm),
          from: trip.startsOn.toISOString(),
          to: endExclusive.toISOString(),
        });
      }),
      // Owner gate already ran above — call the internal compute
      // entry point so we don't redo the trip + ownership lookup.
      section(() => this.transportLegs.computeLegs(trip.id)),
    ]);

    return { trip, itinerary, weather, stays, eateries, events, transport };
  }
}

/**
 * Domain-agnostic section wrapper. Runs the producer, captures any
 * thrown error as a short code, never rejects the caller.
 */
async function section<T>(producer: () => Promise<T>): Promise<Section<T>> {
  try {
    const data = await producer();
    return { ok: true, data };
  } catch (err) {
    const code = coerceCode(err);
    return { ok: false, code };
  }
}

/**
 * Marker thrown by sub-fetches that want to surface a known "skip
 * reason" (e.g., dateless trip can't search stays) rather than a
 * generic error. The outer `section()` extracts the code from here.
 */
class GracefulSkip extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'GracefulSkip';
  }
}

function coerceCode(err: unknown): string {
  if (err instanceof GracefulSkip) return err.code;
  // DomainError subclasses expose a `code` string. Plain errors
  // collapse to a generic marker — clients treat both identically.
  const maybeCode = (err as { code?: unknown }).code;
  if (typeof maybeCode === 'string') return maybeCode;
  return 'INTERNAL_ERROR';
}
