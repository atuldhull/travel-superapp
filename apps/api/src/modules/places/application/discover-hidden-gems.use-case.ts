/**
 * V.UX.19 — "hidden gem" discovery for the domestic / hyper-local
 * persona. A place is a gem when it has *some* review traction but
 * isn't yet popular:
 *
 *   - review_count strictly between 5 and 50 (inclusive at both ends).
 *   - sorted by descending average rating (ties broken by review
 *     count descending — more validation beats less when ratings tie).
 *
 * Domain invariants:
 *   - `radiusKm` in (0, 300] — wider than `SearchPlacesUseCase`'s
 *     50km cap because day-trippers think in driving distance, not
 *     walk-around distance. The DB still uses ST_DWithin so 300km
 *     stays index-bound.
 *   - `limit` clamped to [1, 50]. Default 20.
 *
 * Why aggregate at the use-case (not the repo): the GIS-bounded
 * candidate set is small, and Review carries the (targetType, targetId)
 * shape — Prisma's `groupBy` keeps the round-trips to two
 * (places + reviews). No raw SQL needed; CLAUDE rule 11 is honored
 * because reads of `coordinates` still go through `GeoQueries`.
 *
 * Installed by prompt [V.UX.19].
 */
import { Inject, Injectable } from '@nestjs/common';
import { InvalidRadiusError, ValidationError } from '@app/errors';
import { PrismaService } from '../../../common/db/prisma.service';
import type { PlaceWithDistance } from '../domain/place.entity';
import { PLACE_REPOSITORY, type PlaceRepository } from './ports/place.repository';

const MAX_DAY_TRIP_RADIUS_KM = 300;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const GEM_MIN_REVIEW_COUNT = 5;
const GEM_MAX_REVIEW_COUNT = 50;

export interface DiscoverHiddenGemsCommand {
  readonly center: { readonly lat: number; readonly lng: number };
  readonly radiusKm: number;
  readonly category?: string;
  readonly limit?: number;
}

export interface HiddenGem extends PlaceWithDistance {
  readonly reviewCount: number;
  readonly reviewAverage: number;
}

@Injectable()
export class DiscoverHiddenGemsUseCase {
  constructor(
    @Inject(PLACE_REPOSITORY) private readonly places: PlaceRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async execute(cmd: DiscoverHiddenGemsCommand): Promise<readonly HiddenGem[]> {
    if (!Number.isFinite(cmd.radiusKm) || cmd.radiusKm <= 0) {
      throw new ValidationError(
        'Radius must be a positive number',
        { radiusKm: ['must be > 0'] },
        { radiusKm: cmd.radiusKm },
        'INVALID_RADIUS',
      );
    }
    if (cmd.radiusKm > MAX_DAY_TRIP_RADIUS_KM) {
      throw new InvalidRadiusError(cmd.radiusKm, MAX_DAY_TRIP_RADIUS_KM);
    }
    const limit =
      cmd.limit === undefined
        ? DEFAULT_LIMIT
        : Math.max(1, Math.min(MAX_LIMIT, Math.floor(cmd.limit)));

    const candidates = await this.places.findWithinRadius({
      lat: cmd.center.lat,
      lng: cmd.center.lng,
      radiusKm: cmd.radiusKm,
      ...(cmd.category ? { filters: { category: cmd.category } } : {}),
    });
    if (candidates.length === 0) return [];

    const ids = candidates.map((p) => p.id);
    const groups = await this.prisma.review.groupBy({
      by: ['targetId'],
      where: { targetType: 'place', targetId: { in: ids } },
      _count: { _all: true },
      _avg: { rating: true },
    });

    const stats = new Map<string, { count: number; average: number }>();
    for (const g of groups) {
      const count = g._count._all;
      const avg = g._avg.rating ?? 0;
      stats.set(g.targetId, { count, average: avg });
    }

    const enriched: HiddenGem[] = [];
    for (const p of candidates) {
      const s = stats.get(p.id);
      if (s === undefined) continue;
      if (s.count < GEM_MIN_REVIEW_COUNT || s.count > GEM_MAX_REVIEW_COUNT) continue;
      enriched.push({ ...p, reviewCount: s.count, reviewAverage: s.average });
    }

    enriched.sort((a, b) => {
      if (b.reviewAverage !== a.reviewAverage) return b.reviewAverage - a.reviewAverage;
      return b.reviewCount - a.reviewCount;
    });

    return enriched.slice(0, limit);
  }
}
