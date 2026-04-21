/**
 * Replace the full item list for one day of a trip the caller owns.
 * Clients use this for reorder / remove / add flows:
 *   - Reorder: send the same placeIds with new positions.
 *   - Remove: send a subset.
 *   - Add: send placeIds that weren't there before.
 *   - Wipe: send `[]`.
 *
 * Domain invariants:
 *   - Day must belong to a trip owned by the caller → `TRIP_NOT_FOUND`
 *     (404) on miss. Uniform with every other day-level endpoint —
 *     don't leak existence of other users' days.
 *   - `position` values must be unique within the submitted list.
 *     We canonicalize to 1..N by ascending position anyway, but a
 *     duplicate in the request shape is almost certainly a client
 *     bug — reject with `VALIDATION_FAILED` before persisting.
 *   - Max 20 items per day. Higher counts are suspicious (a real UI
 *     groups), and the stub generator only ever writes 3.
 *   - Every non-null `placeId` must reference an existing Place
 *     row. Missing → `PLACE_NOT_FOUND` (404). Prevents orphaned
 *     FK-violation paths + gives the client a clean signal.
 *
 * Installed by prompt [IV.18.2.11].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError, ValidationError } from '@app/errors';
import type { ItineraryDay } from '../domain/itinerary.entity';
import {
  PLACE_REPOSITORY,
  type PlaceRepository,
} from '../../places/application/ports/place.repository';
import {
  ITINERARY_REPOSITORY,
  type CreateItemInput,
  type ItineraryRepository,
} from './ports/itinerary.repository';

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

    // Scoped day lookup — implicit IDOR defence + surfaces the
    // `tripId` mismatch case (the URL's tripId doesn't match the
    // day's actual trip, even if both are owned by the caller).
    const day = await this.itinerary.findDayForUser(cmd.dayId, cmd.userId);
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
        // We have no findById on the Place port yet; the Places
        // search is radius-scoped. Cheapest valid check today is
        // a findWithinRadius(center, 0.001 km) targeted at the
        // place itself — but that needs the place's coordinates.
        // The pragmatic path: query the place count by id via a
        // no-op search is overkill. Add a lightweight `exists(id)`
        // method to the port instead.
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
