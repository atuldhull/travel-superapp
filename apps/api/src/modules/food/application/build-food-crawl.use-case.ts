/**
 * V.UX.20 — multi-stop "food crawl" itinerary builder for the
 * foodie persona. User picks 2..5 eateries; we return them in a
 * walking-optimised order (greedy nearest-neighbour anchored on the
 * first id) plus the haversine-derived walking duration between
 * consecutive stops + the cumulative total.
 *
 * Why haversine + a constant 1.4 m/s walking speed instead of the
 * routing-provider: a food crawl is door-to-door bipedal hops. The
 * routing-provider's mock returns multipliers off the same haversine
 * basis anyway, and folding in another cross-module DI seam (with a
 * forwardRef back into transport) for a single optimisation isn't
 * worth the surface. Real OSRM walking routes can swap in later via
 * the same `legs[]` shape — this is a presentation surface, not a
 * routing source of truth.
 *
 * Owner-gated against the trip — only the trip owner can ask for a
 * crawl scoped to their trip. 404 `TRIP_NOT_FOUND` if the gate
 * fails (matches the rest of trip-scoped routes).
 *
 * Installed by prompt [V.UX.20].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError, ValidationError } from '@app/errors';
import { GeoQueries } from '../../../common/db/geo-queries';
import { TRIP_REPOSITORY, type TripRepository } from '../../trip/application/ports/trip.repository';

const WALKING_SPEED_MPS = 1.4;
const MIN_STOPS = 2;
const MAX_STOPS = 5;

export interface BuildFoodCrawlCommand {
  readonly tripId: string;
  readonly ownerId: string;
  readonly eateryIds: readonly string[];
}

export interface FoodCrawlStop {
  readonly eateryId: string;
  readonly position: number;
  /** Walking distance from the previous stop (0 for the anchor). */
  readonly distanceMetersFromPrev: number;
  /** Walking duration from the previous stop (0 for the anchor). */
  readonly walkingSecondsFromPrev: number;
}

export interface FoodCrawlPlan {
  readonly stops: readonly FoodCrawlStop[];
  readonly totalDistanceMeters: number;
  readonly totalWalkingSeconds: number;
}

@Injectable()
export class BuildFoodCrawlUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(GeoQueries) private readonly geo: GeoQueries,
  ) {}

  async execute(cmd: BuildFoodCrawlCommand): Promise<FoodCrawlPlan> {
    const trip = await this.trips.findByIdForUser(cmd.tripId, cmd.ownerId);
    if (!trip) {
      throw new NotFoundError('Trip not found', { tripId: cmd.tripId }, 'TRIP_NOT_FOUND');
    }

    const ids = dedup(cmd.eateryIds);
    if (ids.length < MIN_STOPS || ids.length > MAX_STOPS) {
      throw new ValidationError(
        `food crawl needs ${MIN_STOPS}..${MAX_STOPS} eateries`,
        { eateryIds: ['out of range'] },
        { count: ids.length },
        'INVALID_FOOD_CRAWL_SIZE',
      );
    }

    const coords = await this.geo.findCoordinatesForEateryIds(ids);
    const missing = ids.filter((id) => !coords.has(id));
    if (missing.length > 0) {
      throw new NotFoundError(
        'One or more eateries not found',
        { eateryIds: missing },
        'EATERY_NOT_FOUND',
      );
    }

    // Greedy NN anchored on the user-supplied first id.
    const remaining = new Set(ids.slice(1));
    const ordered: string[] = [ids[0]!];
    while (remaining.size > 0) {
      const tail = ordered[ordered.length - 1]!;
      const tailCoord = coords.get(tail)!;
      let bestId: string | null = null;
      let bestDist = Number.POSITIVE_INFINITY;
      for (const candidate of remaining) {
        const cCoord = coords.get(candidate)!;
        const d = haversineMeters(tailCoord, cCoord);
        if (d < bestDist) {
          bestId = candidate;
          bestDist = d;
        }
      }
      if (bestId === null) break;
      ordered.push(bestId);
      remaining.delete(bestId);
    }

    const stops: FoodCrawlStop[] = [];
    let totalDistance = 0;
    let totalSeconds = 0;
    for (let i = 0; i < ordered.length; i++) {
      const eateryId = ordered[i]!;
      let dist = 0;
      if (i > 0) {
        dist = haversineMeters(coords.get(ordered[i - 1]!)!, coords.get(eateryId)!);
      }
      const seconds = dist === 0 ? 0 : Math.round(dist / WALKING_SPEED_MPS);
      totalDistance += dist;
      totalSeconds += seconds;
      stops.push({
        eateryId,
        position: i + 1,
        distanceMetersFromPrev: Math.round(dist),
        walkingSecondsFromPrev: seconds,
      });
    }

    return {
      stops,
      totalDistanceMeters: Math.round(totalDistance),
      totalWalkingSeconds: totalSeconds,
    };
  }
}

function dedup(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Great-circle distance in metres between two WGS-84 points. Used
 * here for walking-distance estimation only — the canonical
 * geodesic is still PostGIS `ST_Distance(::geography)` for any
 * persisted measurement.
 */
function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
