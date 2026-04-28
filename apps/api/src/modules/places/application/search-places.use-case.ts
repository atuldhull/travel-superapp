/**
 * Search places within a radius of a point. Domain invariants:
 *   - `radiusKm` in (0, 50] — tighter cap than Trip's 500km. Search
 *     returns EVERY matching place, so the cost grows with radius²;
 *     50km is big enough for a day-trip scope and small enough that
 *     the seq-scan fallback (if GiST isn't used) stays fast.
 *   - `limit` clamped to [1, 100]. Clients ask for more → we return 100.
 *
 * No IDOR concerns — places are shared, not per-user. Authentication
 * is still required at the controller level (the JwtAuthGuard) to
 * rate-limit search by user.
 *
 * V.UX.14 — `requiredFeatures` filters by `PlaceTag` rows
 * (`key='feature' AND value IN (...)`). A place must carry every
 * requested feature to pass. Feature data is sparse today, so the
 * filter narrows aggressively — that's by design (better an empty
 * set than a misleading "we found family-friendly places" claim).
 *
 * Installed by prompt [IV.18.2.9]; family-mode filter [V.UX.14].
 */
import { Inject, Injectable } from '@nestjs/common';
import { InvalidRadiusError, ValidationError } from '@app/errors';
import { PrismaService } from '../../../common/db/prisma.service';
import type { PlaceWithDistance } from '../domain/place.entity';
import { PLACE_REPOSITORY, type PlaceRepository } from './ports/place.repository';

const MAX_SEARCH_RADIUS_KM = 50;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const PLACE_FEATURE_TAG_KEY = 'feature';

export interface SearchPlacesCommand {
  readonly center: { readonly lat: number; readonly lng: number };
  readonly radiusKm: number;
  readonly category?: string;
  readonly limit?: number;
  /**
   * V.UX.14 — when set, a place must have every listed feature
   * (as a `PlaceTag` row with key='feature') to pass. Empty array
   * is treated the same as omitted.
   */
  readonly requiredFeatures?: readonly string[];
}

@Injectable()
export class SearchPlacesUseCase {
  constructor(
    @Inject(PLACE_REPOSITORY) private readonly places: PlaceRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async execute(cmd: SearchPlacesCommand): Promise<readonly PlaceWithDistance[]> {
    if (!Number.isFinite(cmd.radiusKm) || cmd.radiusKm <= 0) {
      throw new ValidationError(
        'Radius must be a positive number',
        { radiusKm: ['must be > 0'] },
        { radiusKm: cmd.radiusKm },
        'INVALID_RADIUS',
      );
    }
    if (cmd.radiusKm > MAX_SEARCH_RADIUS_KM) {
      throw new InvalidRadiusError(cmd.radiusKm, MAX_SEARCH_RADIUS_KM);
    }
    const limit =
      cmd.limit === undefined
        ? DEFAULT_LIMIT
        : Math.max(1, Math.min(MAX_LIMIT, Math.floor(cmd.limit)));
    const rows = await this.places.findWithinRadius({
      lat: cmd.center.lat,
      lng: cmd.center.lng,
      radiusKm: cmd.radiusKm,
      ...(cmd.category ? { filters: { category: cmd.category } } : {}),
    });

    const features = (cmd.requiredFeatures ?? []).filter((f) => f.length > 0);
    if (features.length === 0) return rows.slice(0, limit);

    // Post-filter: keep only places that carry every requested feature
    // tag. One round-trip pulls the matching tag rows for the candidate
    // ids; we intersect in memory rather than running N tag queries.
    const candidateIds = rows.map((r) => r.id);
    if (candidateIds.length === 0) return [];
    const tagRows = await this.prisma.placeTag.findMany({
      where: {
        placeId: { in: candidateIds },
        key: PLACE_FEATURE_TAG_KEY,
        value: { in: [...features] },
      },
      select: { placeId: true, value: true },
    });
    const featuresByPlace = new Map<string, Set<string>>();
    for (const t of tagRows) {
      let set = featuresByPlace.get(t.placeId);
      if (!set) {
        set = new Set<string>();
        featuresByPlace.set(t.placeId, set);
      }
      set.add(t.value);
    }
    const requiredSet = new Set(features);
    const passing = rows.filter((p) => {
      const have = featuresByPlace.get(p.id);
      if (!have) return false;
      for (const f of requiredSet) if (!have.has(f)) return false;
      return true;
    });
    return passing.slice(0, limit);
  }
}
