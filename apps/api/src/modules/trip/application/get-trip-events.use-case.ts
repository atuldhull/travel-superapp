/**
 * Fetch events near the trip's center for the trip's date window.
 * Fourth cross-module fold-in on Trip (after Weather, Stays,
 * Eateries). Same shape as `GetTripStaysUseCase`: owner gate,
 * PostGIS center read, delegate to the sibling module's own
 * use-case.
 *
 * Dates REQUIRED — events are intrinsically time-scoped ("what's
 * on during my trip" is the canonical question). A dateless trip
 * gets `TRIP_DATES_REQUIRED` (422); client PATCHes dates first.
 * Matches the Trip × Stays policy, not the Trip × Food policy.
 *
 * Radius clamps to Events' 30km cap (Trip allows 500km). Window
 * uses full-day bounds: startsOn @ 00:00:00 UTC → endsOn @ 23:59:59
 * UTC so the whole last day is covered.
 *
 * Installed by prompt [IV.18.9.2].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError, ValidationError } from '@app/errors';
import { GeoQueries } from '../../../common/db/geo-queries';
import { SearchEventsUseCase } from '../../events/application/search-events.use-case';
import type { EventListing } from '../../events/domain/event-listing.entity';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

const EVENTS_MAX_RADIUS_KM = 30;

export interface GetTripEventsCommand {
  readonly tripId: string;
  readonly userId: string;
  readonly category?: string;
}

@Injectable()
export class GetTripEventsUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(GeoQueries) private readonly geo: GeoQueries,
    @Inject(SearchEventsUseCase) private readonly searchEvents: SearchEventsUseCase,
  ) {}

  async execute(cmd: GetTripEventsCommand): Promise<readonly EventListing[]> {
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
        'Trip must have startsOn and endsOn set before searching events',
        { trip: ['startsOn and endsOn required for event search'] },
        { tripId: trip.id },
        'TRIP_DATES_REQUIRED',
      );
    }

    const center = await this.geo.findTripCenter(trip.id);
    if (!center) {
      throw new NotFoundError(
        `Trip not found: ${cmd.tripId}`,
        { tripId: cmd.tripId },
        'TRIP_NOT_FOUND',
      );
    }

    // Full-day bounds so e.g. a 2026-08-01 → 2026-08-03 trip catches
    // an event at 11pm on the 3rd. `endsOn` is stored as a Date at
    // 00:00 UTC by the CreateTripDraft path; offset to end-of-day so
    // the window is inclusive on both sides.
    const fromIso = trip.startsOn.toISOString();
    const endExclusive = new Date(trip.endsOn.getTime() + 24 * 60 * 60 * 1000 - 1);
    const toIso = endExclusive.toISOString();

    return this.searchEvents.execute({
      lat: center.lat,
      lng: center.lng,
      radiusKm: Math.min(EVENTS_MAX_RADIUS_KM, trip.radiusKm),
      from: fromIso,
      to: toIso,
      ...(cmd.category ? { category: cmd.category } : {}),
    });
  }
}
