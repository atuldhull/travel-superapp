/**
 * Trip × Transport fold-in. For a given trip, walk the itinerary
 * day-by-day and, for each consecutive pair of items pinned to a
 * `Place`, ask the Transport module for the available routes
 * between them. Fifth Trip × * overlay (after Weather, Stays,
 * Eateries, Events).
 *
 * Skip semantics — a pair is silently dropped from the response
 * (not an error) when:
 *   - either item has `placeId === null` (free-form note, no
 *     coords to route between);
 *   - one of the placeIds isn't in the catalog (data drift);
 *   - the two places share the same coord (origin === destination);
 *   - the straight-line distance exceeds 500km (the routing
 *     module's `ROUTE_TOO_LONG` cap).
 *
 * Skipping isn't a silent failure mode — it's the right answer:
 * "there is no transport leg here" matches the user's intuition
 * and saves a noisy section in the dashboard.
 *
 * Owner gate runs once at the top — wrong-owner / missing trip
 * collapses to 404 `TRIP_NOT_FOUND` (same IDOR-safe shape every
 * other Trip × * use-case uses).
 *
 * Installed by prompt [IV.18.10.2].
 */
import { Inject, Injectable } from '@nestjs/common';
import { isDomainError, NotFoundError } from '@app/errors';
import { GeoQueries } from '../../../common/db/geo-queries';
import { GetRoutesUseCase } from '../../transport/application/get-routes.use-case';
import type { RouteLeg } from '../../transport/domain/route-leg.entity';
import { ITINERARY_REPOSITORY, type ItineraryRepository } from './ports/itinerary.repository';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

export interface TransportLeg {
  readonly dayId: string;
  readonly dayIndex: number;
  readonly fromItemId: string;
  readonly toItemId: string;
  readonly fromPlaceId: string;
  readonly toPlaceId: string;
  readonly routes: readonly RouteLeg[];
}

@Injectable()
export class GetTripTransportLegsUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(ITINERARY_REPOSITORY) private readonly itinerary: ItineraryRepository,
    @Inject(GeoQueries) private readonly geo: GeoQueries,
    @Inject(GetRoutesUseCase) private readonly getRoutes: GetRoutesUseCase,
  ) {}

  async execute(tripId: string, userId: string): Promise<readonly TransportLeg[]> {
    const trip = await this.trips.findByIdForUser(tripId, userId);
    if (!trip) {
      throw new NotFoundError(`Trip not found: ${tripId}`, { tripId }, 'TRIP_NOT_FOUND');
    }
    return this.computeLegs(trip.id);
  }

  /**
   * Internal entry point used by `GetTripOverviewUseCase` after it
   * has already done the owner gate. Skips the redundant lookup.
   */
  async computeLegs(tripId: string): Promise<readonly TransportLeg[]> {
    const days = await this.itinerary.listDays(tripId);

    // Collect every distinct placeId that appears in any pair so
    // we can fetch all coords in one round-trip.
    const placeIds = new Set<string>();
    for (const day of days) {
      for (const item of day.items) {
        if (item.placeId !== null) placeIds.add(item.placeId);
      }
    }
    const coords = await this.geo.findCoordinatesForPlaceIds([...placeIds]);

    const out: TransportLeg[] = [];
    for (const day of days) {
      // Items already arrive ordered by `position` asc from the
      // repo (Prisma orderBy in the adapter).
      for (let i = 0; i < day.items.length - 1; i++) {
        const from = day.items[i]!;
        const to = day.items[i + 1]!;
        if (from.placeId === null || to.placeId === null) continue;
        const origin = coords.get(from.placeId);
        const destination = coords.get(to.placeId);
        if (!origin || !destination) continue;

        try {
          const routes = await this.getRoutes.execute({ origin, destination });
          out.push({
            dayId: day.id,
            dayIndex: day.dayIndex,
            fromItemId: from.id,
            toItemId: to.id,
            fromPlaceId: from.placeId,
            toPlaceId: to.placeId,
            routes,
          });
        } catch (err) {
          // Routing's two domain errors (`SAME_ORIGIN_DESTINATION`,
          // `ROUTE_TOO_LONG`) are normal "no leg here" outcomes.
          // Silently drop the pair and move on — anything else
          // bubbles so the global filter can map it.
          if (isExpectedSkip(err)) continue;
          throw err;
        }
      }
    }
    return out;
  }
}

function isExpectedSkip(err: unknown): boolean {
  if (!isDomainError(err)) return false;
  return err.code === 'SAME_ORIGIN_DESTINATION' || err.code === 'ROUTE_TOO_LONG';
}
