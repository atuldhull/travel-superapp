/**
 * Fetch eateries near the trip's center. Third cross-module fold-in
 * (after Trip × Weather + Trip × Stays) — same shape: owner gate,
 * PostGIS `center` read via `GeoQueries`, delegate to the Food
 * module's own use-case.
 *
 * Unlike Trip × Stays, this does NOT require trip dates — "show me
 * restaurants near my trip" is a meaningful question whether or not
 * dates are set. The trip is the anchor, not the search window.
 *
 * Radius clamps to the Food module's 25km domain cap (Trip's own
 * radius can reach 500km). Without the clamp a long-range trip
 * would always 422.
 *
 * Installed by prompt [IV.18.7.2].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { GeoQueries } from '../../../common/db/geo-queries';
import { SearchEateriesUseCase } from '../../food/application/search-eateries.use-case';
import type { EateryListing } from '../../food/domain/eatery-listing.entity';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

const EATERY_SEARCH_MAX_RADIUS_KM = 25;

export interface GetTripEateriesCommand {
  readonly tripId: string;
  readonly userId: string;
  readonly cuisineTag?: string;
  readonly maxPriceTier?: number;
}

@Injectable()
export class GetTripEateriesUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(GeoQueries) private readonly geo: GeoQueries,
    @Inject(SearchEateriesUseCase) private readonly searchEateries: SearchEateriesUseCase,
  ) {}

  async execute(cmd: GetTripEateriesCommand): Promise<readonly EateryListing[]> {
    const trip = await this.trips.findByIdForUser(cmd.tripId, cmd.userId);
    if (!trip) {
      throw new NotFoundError(
        `Trip not found: ${cmd.tripId}`,
        { tripId: cmd.tripId },
        'TRIP_NOT_FOUND',
      );
    }

    const center = await this.geo.findTripCenter(trip.id);
    if (!center) {
      // PostGIS row missing — invariant violation from direct SQL
      // tampering only. Collapse to the 404 the client already
      // understands.
      throw new NotFoundError(
        `Trip not found: ${cmd.tripId}`,
        { tripId: cmd.tripId },
        'TRIP_NOT_FOUND',
      );
    }

    return this.searchEateries.execute({
      lat: center.lat,
      lng: center.lng,
      radiusKm: Math.min(EATERY_SEARCH_MAX_RADIUS_KM, trip.radiusKm),
      ...(cmd.cuisineTag ? { cuisineTag: cmd.cuisineTag } : {}),
      ...(cmd.maxPriceTier !== undefined ? { maxPriceTier: cmd.maxPriceTier } : {}),
    });
  }
}
