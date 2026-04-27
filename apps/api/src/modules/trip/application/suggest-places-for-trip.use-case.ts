/**
 * Suggest 6 ranked places for a trip — backbone for the V.UX.4
 * "weekend traveler" picker. Owner-gated, reads the trip's center
 * via GeoQueries (CLAUDE rule 11), federates to the configured
 * provider, write-throughs into the canonical Place catalog so the
 * caller gets persisted `placeId`s ready to drop into itinerary
 * items.
 *
 * Why exactly 6:
 *   - The picker UI shows a 2x3 (or 3x2) grid; 6 is enough variety
 *     for a 2-day weekend (≤ 4 per day) without overwhelming.
 *   - Provider returns more than 6 in dense cities; we slice after
 *     ingest so the ingest call mirrors the intent ("these are the
 *     candidates we'll show").
 *
 * Ranking: provider sorts by distance ascending; we keep that
 * ordering. A future slice can fold in `relaxationScore` or category
 * diversity — kept stub-simple here.
 *
 * Radius: clamped at 30km (a weekend traveler isn't driving 200km
 * for a coffee). Trip's own radius can reach 500km.
 *
 * Installed by prompt [V.UX.4].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { GeoQueries } from '../../../common/db/geo-queries';
import { FederatedSearchPlacesUseCase } from '../../places/application/federated-search-places.use-case';
import { IngestFederatedResultsUseCase } from '../../places/application/ingest-federated-results.use-case';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

const SUGGESTION_MAX_RADIUS_KM = 30;
const SUGGESTION_LIMIT = 6;

export interface SuggestPlacesForTripCommand {
  readonly tripId: string;
  readonly userId: string;
  readonly category?: string;
}

export interface SuggestedPlace {
  readonly placeId: string;
  readonly name: string;
  readonly category: string;
  readonly distanceMeters: number;
}

@Injectable()
export class SuggestPlacesForTripUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(GeoQueries) private readonly geo: GeoQueries,
    private readonly federated: FederatedSearchPlacesUseCase,
    private readonly ingest: IngestFederatedResultsUseCase,
  ) {}

  async execute(cmd: SuggestPlacesForTripCommand): Promise<readonly SuggestedPlace[]> {
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
      throw new NotFoundError(
        `Trip not found: ${cmd.tripId}`,
        { tripId: cmd.tripId },
        'TRIP_NOT_FOUND',
      );
    }

    const radiusKm = Math.min(SUGGESTION_MAX_RADIUS_KM, trip.radiusKm);
    const candidates = await this.federated.execute({
      center: { lat: center.lat, lng: center.lng },
      radiusKm,
      ...(cmd.category ? { category: cmd.category } : {}),
    });

    const top = candidates.slice(0, SUGGESTION_LIMIT);
    const ingested = await this.ingest.execute(top);

    return ingested.map((row) => ({
      placeId: row.place.id,
      name: row.place.name,
      category: row.place.category,
      distanceMeters: row.distanceMeters,
    }));
  }
}
