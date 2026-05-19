/**
 * Owner-gated use-case that delegates plan generation to whichever
 * `TripPlannerPort` adapter is registered (Claude or stub).
 *
 * The trip lookup uses the same owner gate as `GetTripUseCase`; a
 * non-owner / missing trip returns 404 `TRIP_NOT_FOUND` so the route
 * doesn't leak existence (existence-probe defence).
 *
 * Installed by prompt [IV.18.19.44].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { GeoQueries } from '../../../common/db/geo-queries';
import {
  TRIP_PLANNER_PORT,
  type TripPlannerPort,
  type TripPlannerResult,
} from './ports/trip-planner.port';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

@Injectable()
export class GeneratePlanWithAiUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(GeoQueries) private readonly geo: GeoQueries,
    @Inject(TRIP_PLANNER_PORT) private readonly planner: TripPlannerPort,
  ) {}

  /**
   * `instruction` (Phase 2, E4) is an optional free-text focus the
   * create flow composes from trip-type + region + the traveller's
   * preferences. It's transient (NOT persisted — no schema column);
   * the planner port already consumes `instruction`.
   */
  async execute(tripId: string, userId: string, instruction?: string): Promise<TripPlannerResult> {
    const trip = await this.trips.findByIdForUser(tripId, userId);
    if (!trip) {
      throw new NotFoundError(`Trip not found: ${tripId}`, { tripId }, 'TRIP_NOT_FOUND');
    }
    const center = await this.geo.findTripCenter(tripId);
    if (!center) {
      throw new NotFoundError(`Trip center missing: ${tripId}`, { tripId }, 'TRIP_NOT_FOUND');
    }
    const trimmed = instruction?.trim();
    return this.planner.generatePlan({
      title: trip.title,
      center,
      radiusKm: trip.radiusKm,
      startsOn: trip.startsOn ?? null,
      endsOn: trip.endsOn ?? null,
      ...(trimmed ? { instruction: trimmed.slice(0, 600) } : {}),
    });
  }
}
