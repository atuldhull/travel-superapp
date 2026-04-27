/**
 * Duplicate one of the caller's own trips. Deep-copies title (with a
 * " copy" suffix), center, radius, dates, and the itinerary days +
 * items. Always lands as `status: 'draft'` on the new trip — even if
 * the source was published — so the duplicate doesn't accidentally
 * surface as a finished plan.
 *
 * Why deep-copy: V.UX.5 frequent-business-traveler. They re-use the
 * same hotel chain + airport pickup itinerary every month; without
 * deep-copy they'd manually re-enter every item.
 *
 * Owner gate: source trip must belong to the caller (404 otherwise).
 * The new trip is owned by the caller — we don't allow duplicating
 * someone else's trip even if they granted a TripShare.
 *
 * Item shape: `placeId` + `notes` are preserved; `startTime` /
 * `endTime` are NOT (they're per-trip absolute timestamps; carrying
 * them to a future trip would be a bug, not a feature). Day index +
 * date are recomputed against the new trip's startsOn so the duplicate
 * has the same shape but fresh dates.
 *
 * Installed by prompt [V.UX.5].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { GeoQueries } from '../../../common/db/geo-queries';
import type { Trip } from '../domain/trip.entity';
import {
  ITINERARY_REPOSITORY,
  type CreateDayInput,
  type CreateItemInput,
  type ItineraryRepository,
} from './ports/itinerary.repository';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

const DUPLICATE_SUFFIX = ' (copy)';

export interface DuplicateTripCommand {
  readonly tripId: string;
  readonly userId: string;
}

@Injectable()
export class DuplicateTripUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(ITINERARY_REPOSITORY) private readonly itinerary: ItineraryRepository,
    @Inject(GeoQueries) private readonly geo: GeoQueries,
  ) {}

  async execute(cmd: DuplicateTripCommand): Promise<Trip> {
    const source = await this.trips.findByIdForUser(cmd.tripId, cmd.userId);
    if (!source) {
      throw new NotFoundError(
        `Trip not found: ${cmd.tripId}`,
        { tripId: cmd.tripId },
        'TRIP_NOT_FOUND',
      );
    }

    const center = await this.geo.findTripCenter(source.id);
    if (!center) {
      // PostGIS row gone — invariant violation only reachable via
      // raw-SQL tampering. 404 to match every other Trip surface.
      throw new NotFoundError(
        `Trip not found: ${cmd.tripId}`,
        { tripId: cmd.tripId },
        'TRIP_NOT_FOUND',
      );
    }

    const duplicate = await this.trips.createDraft({
      userId: cmd.userId,
      title: `${source.title}${DUPLICATE_SUFFIX}`,
      lat: center.lat,
      lng: center.lng,
      radiusKm: source.radiusKm,
      startsOn: source.startsOn,
      endsOn: source.endsOn,
    });

    const sourceDays = await this.itinerary.listDays(source.id);
    if (sourceDays.length === 0) {
      return duplicate;
    }

    // Recompute day dates against the duplicate's startsOn so the
    // copy is internally consistent — `dayIndex` 0 maps to the new
    // trip's startsOn (or, when no startsOn, falls back to today).
    const baseDate = duplicate.startsOn ?? source.startsOn ?? new Date();
    const baseUtc = new Date(
      Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate()),
    );
    const dayInputs: CreateDayInput[] = sourceDays.map((d, i) => {
      const date = new Date(baseUtc);
      date.setUTCDate(baseUtc.getUTCDate() + i);
      const items: CreateItemInput[] = d.items.map((it, idx) => ({
        position: idx + 1,
        placeId: it.placeId ?? null,
        notes: it.notes ?? null,
      }));
      return {
        tripId: duplicate.id,
        dayIndex: d.dayIndex,
        date,
        summary: d.summary,
        items,
      };
    });
    await this.itinerary.replaceDays(duplicate.id, dayInputs);

    return duplicate;
  }
}
