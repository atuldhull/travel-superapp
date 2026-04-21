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
 * Installed by prompt [IV.18.2.9].
 */
import { Inject, Injectable } from '@nestjs/common';
import { InvalidRadiusError, ValidationError } from '@app/errors';
import type { PlaceWithDistance } from '../domain/place.entity';
import { PLACE_REPOSITORY, type PlaceRepository } from './ports/place.repository';

const MAX_SEARCH_RADIUS_KM = 50;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface SearchPlacesCommand {
  readonly center: { readonly lat: number; readonly lng: number };
  readonly radiusKm: number;
  readonly category?: string;
  readonly limit?: number;
}

@Injectable()
export class SearchPlacesUseCase {
  constructor(@Inject(PLACE_REPOSITORY) private readonly places: PlaceRepository) {}

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
    return rows.slice(0, limit);
  }
}
