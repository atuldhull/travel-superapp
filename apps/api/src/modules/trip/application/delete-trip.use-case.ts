/**
 * Delete a trip + cascade. Prisma's `onDelete: Cascade` on the
 * schema handles `ItineraryDay` → `ItineraryItem`, `TripVersion`,
 * `TripShare`, `Vote`, `Expense`, `Review`, `MediaAsset`, and
 * `LiveEvent` rows.
 *
 * Not-mine / not-exists are the same 404 shape as GET + PATCH —
 * don't leak existence of other users' trips.
 *
 * Installed by prompt [IV.18.2.3.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '@app/events';
import { NotFoundError } from '@app/errors';
import { getTraceContext } from '@app/logger';
import { makeEvent, type TripDeletedEvent } from '../domain/trip.events';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

@Injectable()
export class DeleteTripUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  async execute(tripId: string, userId: string): Promise<void> {
    const deleted = await this.trips.deleteForUser(tripId, userId);
    if (!deleted) {
      throw new NotFoundError(`Trip not found: ${tripId}`, { tripId }, 'TRIP_NOT_FOUND');
    }
    const evt: TripDeletedEvent = makeEvent(
      'Trip.TripDeleted',
      { tripId, userId },
      getTraceContext()?.traceId ? { traceId: getTraceContext()!.traceId } : {},
    );
    await this.events.publish(evt);
  }
}
