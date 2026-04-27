/**
 * Resolve coords for every routable item on a single day. Used by
 * the V.UX.6 power-planner RouteMap so the polyline can recompute
 * locally on every drag without a server round-trip.
 *
 * Owner OR active-share gate (same as updateDay/optimizeDay). Items
 * without a `placeId` are silently skipped — they don't have coords
 * to draw a leg for.
 *
 * Installed by prompt [V.UX.6].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { GeoQueries } from '../../../common/db/geo-queries';
import { ITINERARY_REPOSITORY, type ItineraryRepository } from './ports/itinerary.repository';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';
import { TRIP_SHARE_REPOSITORY, type TripShareRepository } from './ports/trip-share.repository';

export interface DayRouteCoord {
  readonly itemId: string;
  readonly placeId: string;
  readonly lat: number;
  readonly lng: number;
}

@Injectable()
export class GetDayRouteCoordsUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(TRIP_SHARE_REPOSITORY) private readonly shares: TripShareRepository,
    @Inject(ITINERARY_REPOSITORY) private readonly itinerary: ItineraryRepository,
    @Inject(GeoQueries) private readonly geo: GeoQueries,
  ) {}

  async execute(tripId: string, dayId: string, userId: string): Promise<readonly DayRouteCoord[]> {
    const owns = await this.trips.findByIdForUser(tripId, userId);
    if (!owns) {
      const active = await this.shares.countActiveSharesForTrip(tripId);
      if (active === 0) {
        throw new NotFoundError(`Trip not found: ${tripId}`, { tripId }, 'TRIP_NOT_FOUND');
      }
    }
    const day = await this.itinerary.findDayById(dayId);
    if (!day || day.tripId !== tripId) {
      throw new NotFoundError(`Day not found: ${dayId}`, { tripId, dayId }, 'TRIP_NOT_FOUND');
    }
    const placeIds = day.items.map((it) => it.placeId).filter((id): id is string => id !== null);
    if (placeIds.length === 0) return [];
    const coords = await this.geo.findCoordinatesForPlaceIds(placeIds);
    const out: DayRouteCoord[] = [];
    for (const item of day.items) {
      if (!item.placeId) continue;
      const c = coords.get(item.placeId);
      if (!c) continue;
      out.push({ itemId: item.id, placeId: item.placeId, lat: c.lat, lng: c.lng });
    }
    return out;
  }
}
