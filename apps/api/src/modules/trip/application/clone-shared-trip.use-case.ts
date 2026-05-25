/**
 * Clone a shared trip into the caller's own account. The recipient
 * resolves the public share-code (no auth needed for browsing), then
 * — once they're signed in — they hit this verb to take a private
 * deep-copy.
 *
 * Owner of the clone = caller. Title gets a "(saved)" suffix so the
 * recipient can tell their copy apart from any subsequent visit to
 * the original. Days + items are copied with `position` preserved;
 * `placeId` + `notes` carry over; absolute timestamps don't (same
 * policy as `DuplicateTripUseCase`).
 *
 * Errors:
 *   - SHARE_NOT_FOUND — code doesn't resolve, was revoked, or expired.
 *   - The clone always succeeds for a valid resolve; PostGIS center is
 *     copied via GeoQueries from the source row.
 *
 * Installed by prompt [V.UX.10].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { CLOCK, type Clock } from '@app/clock';
import { GeoQueries } from '../../../common/db/geo-queries';
import type { Trip } from '../domain/trip.entity';
import {
  ITINERARY_REPOSITORY,
  type CreateDayInput,
  type CreateItemInput,
  type ItineraryRepository,
} from './ports/itinerary.repository';
import { ResolveTripShareUseCase } from './resolve-trip-share.use-case';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

const CLONE_SUFFIX = ' (saved)';

@Injectable()
export class CloneSharedTripUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(ITINERARY_REPOSITORY) private readonly itinerary: ItineraryRepository,
    @Inject(GeoQueries) private readonly geo: GeoQueries,
    private readonly resolveShare: ResolveTripShareUseCase,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(shareCode: string, userId: string): Promise<Trip> {
    // resolveShare throws SHARE_NOT_FOUND / SHARE_EXPIRED — fine to
    // surface those upstream as 404s with the same code.
    const resolved = await this.resolveShare.execute(shareCode);

    // Source center via GeoQueries — `Trip.center` is `Unsupported` in
    // Prisma's generated type (CLAUDE rule 11).
    const center = await this.geo.findTripCenter(resolved.trip.id);
    if (!center) {
      throw new NotFoundError('Trip not found', { tripId: resolved.trip.id }, 'TRIP_NOT_FOUND');
    }

    const clone = await this.trips.createDraft({
      userId,
      title: `${resolved.trip.title}${CLONE_SUFFIX}`,
      lat: center.lat,
      lng: center.lng,
      radiusKm: resolved.trip.radiusKm,
      startsOn: resolved.trip.startsOn,
      endsOn: resolved.trip.endsOn,
    });

    if (resolved.days.length === 0) return clone;

    // Recompute day dates against the clone's own startsOn (matches
    // DuplicateTripUseCase). `dayIndex` keeps the original ordering.
    const baseDate = clone.startsOn ?? resolved.trip.startsOn ?? this.clock.now();
    const baseUtc = new Date(
      Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate()),
    );
    const dayInputs: CreateDayInput[] = resolved.days.map((d, i) => {
      const date = new Date(baseUtc);
      date.setUTCDate(baseUtc.getUTCDate() + i);
      const items: CreateItemInput[] = d.items.map((it, idx) => ({
        position: idx + 1,
        placeId: it.placeId ?? null,
        notes: it.notes ?? null,
      }));
      return {
        tripId: clone.id,
        dayIndex: d.dayIndex,
        date,
        summary: d.summary,
        items,
      };
    });
    await this.itinerary.replaceDays(clone.id, dayInputs);

    return clone;
  }
}
