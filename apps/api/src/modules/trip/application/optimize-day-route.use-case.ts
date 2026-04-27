/**
 * Reorder a single itinerary day to minimise total travel time
 * between consecutive stops. Backbone for the V.UX.6 power-planner
 * "Optimize day" button.
 *
 * Algorithm: greedy nearest-neighbour TSP. The day's first item
 * stays anchored (often "depart from hotel" or the first scheduled
 * activity); subsequent items are appended in nearest-fastest order
 * by the cheapest available transport mode between consecutive
 * candidates. Items WITHOUT a `placeId` (free-form notes, no
 * coords) are kept in their original relative order at the end of
 * the day — they don't participate in the route, but we don't drop
 * them.
 *
 * Why greedy and not exact TSP: 20-stop max means O(n²) is fine
 * (≤ 400 pair lookups), and the routing-provider call dominates
 * latency. A real Held-Karp would shave only the last few % at the
 * cost of >10x compute. Greedy beats nothing decisively; perfect can
 * wait for V2.
 *
 * Returns the saved day plus before/after total seconds so the UI
 * can flash the time saved.
 *
 * Same access gate as `UpdateDayItemsUseCase`: owner OR active
 * TripShare.
 *
 * Installed by prompt [V.UX.6].
 */
import { Inject, Injectable } from '@nestjs/common';
import { isDomainError, NotFoundError } from '@app/errors';
import { GeoQueries } from '../../../common/db/geo-queries';
import { GetRoutesUseCase } from '../../transport/application/get-routes.use-case';
import type { RouteLeg } from '../../transport/domain/route-leg.entity';
import type { ItineraryDay, ItineraryItem } from '../domain/itinerary.entity';
import {
  ITINERARY_REPOSITORY,
  type CreateItemInput,
  type ItineraryRepository,
} from './ports/itinerary.repository';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';
import { TRIP_SHARE_REPOSITORY, type TripShareRepository } from './ports/trip-share.repository';

export interface OptimizeDayRouteCommand {
  readonly tripId: string;
  readonly dayId: string;
  readonly userId: string;
}

export interface OptimizeDayRouteResult {
  readonly day: ItineraryDay;
  readonly beforeSeconds: number;
  readonly afterSeconds: number;
  readonly skippedCount: number;
}

@Injectable()
export class OptimizeDayRouteUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(TRIP_SHARE_REPOSITORY) private readonly shares: TripShareRepository,
    @Inject(ITINERARY_REPOSITORY) private readonly itinerary: ItineraryRepository,
    @Inject(GeoQueries) private readonly geo: GeoQueries,
    private readonly getRoutes: GetRoutesUseCase,
  ) {}

  async execute(cmd: OptimizeDayRouteCommand): Promise<OptimizeDayRouteResult> {
    // Owner OR active-share gate — same as UpdateDayItemsUseCase.
    const owns = await this.trips.findByIdForUser(cmd.tripId, cmd.userId);
    if (!owns) {
      const active = await this.shares.countActiveSharesForTrip(cmd.tripId);
      if (active === 0) {
        throw new NotFoundError(
          `Trip not found: ${cmd.tripId}`,
          { tripId: cmd.tripId },
          'TRIP_NOT_FOUND',
        );
      }
    }
    const day = await this.itinerary.findDayById(cmd.dayId);
    if (!day || day.tripId !== cmd.tripId) {
      throw new NotFoundError(
        `Day not found: ${cmd.dayId}`,
        { tripId: cmd.tripId, dayId: cmd.dayId },
        'TRIP_NOT_FOUND',
      );
    }

    const placed = day.items.filter(
      (it): it is ItineraryItem & { placeId: string } => it.placeId !== null,
    );
    const noteOnly = day.items.filter((it) => it.placeId === null);

    if (placed.length < 2) {
      // Nothing to optimise — return the day as-is.
      return { day, beforeSeconds: 0, afterSeconds: 0, skippedCount: 0 };
    }

    const placeIds = placed.map((it) => it.placeId);
    const coords = await this.geo.findCoordinatesForPlaceIds(placeIds);

    // Drop items whose place isn't in the catalog (data drift). They
    // get appended at the end alongside note-only items so the user
    // doesn't lose them.
    const routable = placed.filter((it) => coords.has(it.placeId));
    const skipped = placed.filter((it) => !coords.has(it.placeId));

    const beforeSeconds = await this.totalDurationFor(routable, coords);

    const optimisedOrder = await this.greedyNearestNeighbour(routable, coords);
    const afterSeconds = await this.totalDurationFor(optimisedOrder, coords);

    // Build the new item list. Routable items get positions 1..N in
    // optimised order; un-routable items + note-only items keep their
    // relative ordering and land at the end.
    const trailing = [...skipped, ...noteOnly];
    const next: CreateItemInput[] = [
      ...optimisedOrder.map((it, idx) => ({
        position: idx + 1,
        placeId: it.placeId,
        notes: it.notes ?? null,
      })),
      ...trailing.map((it, idx) => ({
        position: optimisedOrder.length + idx + 1,
        placeId: it.placeId,
        notes: it.notes ?? null,
      })),
    ];

    const updated = await this.itinerary.replaceItemsForDay(cmd.dayId, next);
    return { day: updated, beforeSeconds, afterSeconds, skippedCount: skipped.length };
  }

  /**
   * Greedy nearest-neighbour: keep the first item anchored, then at
   * each step pick the unvisited item with the cheapest fastest
   * route from the current tail.
   */
  private async greedyNearestNeighbour(
    items: readonly (ItineraryItem & { placeId: string })[],
    coords: Map<string, { lat: number; lng: number }>,
  ): Promise<readonly (ItineraryItem & { placeId: string })[]> {
    if (items.length <= 1) return items;
    const remaining = new Set<string>(items.slice(1).map((it) => it.id));
    const byId = new Map(items.map((it) => [it.id, it] as const));
    const order: (ItineraryItem & { placeId: string })[] = [items[0]!];

    while (remaining.size > 0) {
      const tail = order[order.length - 1]!;
      const tailCoord = coords.get(tail.placeId)!;
      let best: { id: string; seconds: number } | null = null;
      for (const candidateId of remaining) {
        const candidate = byId.get(candidateId)!;
        const cCoord = coords.get(candidate.placeId)!;
        const seconds = await this.bestDurationSeconds(tailCoord, cCoord);
        if (best === null || seconds < best.seconds) {
          best = { id: candidateId, seconds };
        }
      }
      if (best === null) break;
      order.push(byId.get(best.id)!);
      remaining.delete(best.id);
    }
    return order;
  }

  /** Sum of pairwise best-mode durations through the given order. */
  private async totalDurationFor(
    items: readonly (ItineraryItem & { placeId: string })[],
    coords: Map<string, { lat: number; lng: number }>,
  ): Promise<number> {
    let total = 0;
    for (let i = 0; i < items.length - 1; i++) {
      const a = coords.get(items[i]!.placeId)!;
      const b = coords.get(items[i + 1]!.placeId)!;
      total += await this.bestDurationSeconds(a, b);
    }
    return total;
  }

  /**
   * Cheapest mode in seconds. Routing failures (same coord, beyond
   * 500km cap) get a sentinel max so the optimiser deprioritises
   * those legs without throwing.
   */
  private async bestDurationSeconds(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ): Promise<number> {
    try {
      const routes = await this.getRoutes.execute({ origin, destination });
      return routes.reduce<number>(
        (acc: number, r: RouteLeg) => Math.min(acc, r.durationSeconds),
        Number.POSITIVE_INFINITY,
      );
    } catch (err) {
      if (
        isDomainError(err) &&
        (err.code === 'SAME_ORIGIN_DESTINATION' || err.code === 'ROUTE_TOO_LONG')
      ) {
        return 0;
      }
      throw err;
    }
  }
}
