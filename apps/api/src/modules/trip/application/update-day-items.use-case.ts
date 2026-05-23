/**
 * Replace the full item list for one day of a trip the caller can
 * edit. "Can edit" = caller owns the trip OR the trip has at
 * least one active TripShare (collab gate). Same gate Social's
 * voting + expenses + reviews use; reusing it here lets group
 * trip planning actually be collaborative.
 *
 * Clients use this for reorder / remove / add flows:
 *   - Reorder: send the same placeIds with new positions.
 *   - Remove: send a subset.
 *   - Add: send placeIds that weren't there before.
 *   - Wipe: send `[]`.
 *
 * Domain invariants:
 *   - Day must belong to the URL's trip + caller must have edit
 *     access (owner OR active share). Both miss-paths collapse to
 *     a single 404 `TRIP_NOT_FOUND` — same IDOR-defence policy
 *     used everywhere else in this module.
 *   - `position` values must be unique within the submitted list.
 *   - Max 20 items per day.
 *   - Every non-null `placeId` must reference an existing Place
 *     row. Missing → `PLACE_NOT_FOUND` (404).
 *
 * Installed by prompt [IV.18.2.11]; collab gate added in
 * [IV.18.2.14].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError, ValidationError } from '@app/errors';
import type { ItineraryDay } from '../domain/itinerary.entity';
import { PLACE_REPOSITORY, type PlaceRepository } from '../../places';
import {
  ITINERARY_REPOSITORY,
  type CreateItemInput,
  type ItineraryRepository,
} from './ports/itinerary.repository';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';
import { TRIP_SHARE_REPOSITORY, type TripShareRepository } from './ports/trip-share.repository';

const MAX_ITEMS_PER_DAY = 20;

export interface UpdateDayItemsCommand {
  readonly tripId: string;
  readonly dayId: string;
  readonly userId: string;
  readonly items: ReadonlyArray<{
    readonly position: number;
    readonly placeId: string | null;
    readonly notes?: string | null;
  }>;
}

@Injectable()
export class UpdateDayItemsUseCase {
  constructor(
    @Inject(ITINERARY_REPOSITORY) private readonly itinerary: ItineraryRepository,
    @Inject(PLACE_REPOSITORY) private readonly places: PlaceRepository,
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(TRIP_SHARE_REPOSITORY) private readonly shares: TripShareRepository,
  ) {}

  async execute(cmd: UpdateDayItemsCommand): Promise<ItineraryDay> {
    if (cmd.items.length > MAX_ITEMS_PER_DAY) {
      throw new ValidationError(
        `Too many items for one day (max ${MAX_ITEMS_PER_DAY})`,
        { items: [`length > ${MAX_ITEMS_PER_DAY}`] },
        { received: cmd.items.length, cap: MAX_ITEMS_PER_DAY },
        'TOO_MANY_ITEMS',
      );
    }

    // Unique positions per day — DB enforces via @@unique but we
    // prefer a clean 422 over a Prisma P2002.
    const positions = new Set<number>();
    for (const it of cmd.items) {
      if (positions.has(it.position)) {
        throw new ValidationError(
          `Duplicate position ${it.position}`,
          { items: [`position ${it.position} repeats`] },
          { duplicatedPosition: it.position },
          'DUPLICATE_POSITION',
        );
      }
      positions.add(it.position);
    }

    // Collab-aware access gate: owner OR active share. Mirrors
    // Social's `assertCanVote` exactly so future tightening
    // (e.g. publicRead-only shares can't edit) lands across all
    // collab paths in one slice. Inlined here rather than
    // imported from Social to avoid a Trip → Social cycle (Social
    // already imports Trip).
    const ownTrip = await this.trips.findByIdForUser(cmd.tripId, cmd.userId);
    if (!ownTrip) {
      const activeShares = await this.shares.countActiveSharesForTrip(cmd.tripId);
      if (activeShares === 0) {
        throw new NotFoundError(
          `Trip not found: ${cmd.tripId}`,
          { tripId: cmd.tripId },
          'TRIP_NOT_FOUND',
        );
      }
      // V.UX.8 lock gate: share-collaborators can't mutate when the
      // owner has flipped the trip to `published` (= locked). Owner
      // path skips this branch entirely (ownTrip non-null).
      const tripRow = await this.trips.findById(cmd.tripId);
      if (tripRow && tripRow.status === 'published') {
        throw new NotFoundError(
          `Trip not found: ${cmd.tripId}`,
          { tripId: cmd.tripId },
          'TRIP_NOT_FOUND',
        );
      }
    }

    // Day lookup is unscoped now — the access gate above already
    // ran. Verify the day actually belongs to the URL's tripId
    // (a non-owner caller could otherwise pass an arbitrary dayId
    // referencing a different trip they have NO share for).
    const day = await this.itinerary.findDayById(cmd.dayId);
    if (!day || day.tripId !== cmd.tripId) {
      throw new NotFoundError(
        `Day not found: ${cmd.dayId}`,
        { tripId: cmd.tripId, dayId: cmd.dayId },
        'TRIP_NOT_FOUND',
      );
    }

    // Every non-null placeId must exist. Deduplicate lookups so
    // "same place in 3 items" doesn't 3x the DB hits.
    const placeIds = [
      ...new Set(cmd.items.map((it) => it.placeId).filter((id): id is string => id !== null)),
    ];
    if (placeIds.length > 0) {
      const missing: string[] = [];
      for (const id of placeIds) {
        if (!(await this.places.exists(id))) missing.push(id);
      }
      if (missing.length > 0) {
        throw new NotFoundError(
          `Place(s) not found: ${missing.join(', ')}`,
          { missingPlaceIds: missing },
          'PLACE_NOT_FOUND',
        );
      }
    }

    const input: CreateItemInput[] = cmd.items.map((it) => ({
      position: it.position,
      placeId: it.placeId,
      notes: it.notes ?? null,
    }));
    return this.itinerary.replaceItemsForDay(cmd.dayId, input);
  }
}
