/**
 * V.UX.8 lock / unlock. The group-trip organiser flips a trip's
 * status to `published` to "freeze" the plan — collaborators with an
 * active TripShare can still view + vote + record expenses, but only
 * the owner can mutate the itinerary or trip metadata. Unlock flips
 * back to `draft`.
 *
 * Status reuse rationale: rather than add a `lockedAt` column, the
 * existing TripStatus enum (draft / published / archived) gives us
 * "published === locked" semantics for free. Avoids a migration; the
 * UI already renders a `published` badge.
 *
 * Owner-only (no share path) — locking is a final-say verb. Missing
 * trip / wrong owner collapses to 404 `TRIP_NOT_FOUND`, same IDOR-
 * safe shape every other Trip endpoint uses.
 *
 * [F4]: the "can this trip transition?" gate lives in
 * `domain/trip-transitions.ts` now — the use-case is a coordinator,
 * not the rule keeper.
 *
 * Installed by prompt [V.UX.8].
 */
import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '@app/events';
import { NotFoundError } from '@app/errors';
import { getTraceContext } from '@app/logger';
import type { Trip } from '../domain/trip.entity';
import { makeEvent, type TripLockedEvent } from '../domain/trip.events';
import {
  assertCanLock,
  assertCanUnlock,
  markLocked,
  markUnlocked,
} from '../domain/trip-transitions';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

@Injectable()
export class LockTripUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  async execute(tripId: string, userId: string): Promise<Trip> {
    const trip = await this.trips.findByIdForUser(tripId, userId);
    if (!trip) {
      throw new NotFoundError(`Trip not found: ${tripId}`, { tripId }, 'TRIP_NOT_FOUND');
    }
    // Domain-side gate: throws TRIP_ARCHIVED if archived ([F4]).
    assertCanLock(trip);
    if (trip.status === 'published') return trip; // already-locked idempotency
    await this.trips.updateStatus(tripId, 'published');

    // V.UX.9: notify active collaborators that the trip is now
    // frozen. Best-effort; subscribers handle their own retries.
    const evt: TripLockedEvent = makeEvent(
      'Trip.TripLocked',
      { tripId: trip.id, ownerId: trip.userId, title: trip.title },
      getTraceContext()?.traceId ? { traceId: getTraceContext()!.traceId } : {},
    );
    await this.events.publish(evt);

    return markLocked(trip);
  }
}

@Injectable()
export class UnlockTripUseCase {
  constructor(@Inject(TRIP_REPOSITORY) private readonly trips: TripRepository) {}

  async execute(tripId: string, userId: string): Promise<Trip> {
    const trip = await this.trips.findByIdForUser(tripId, userId);
    if (!trip) {
      throw new NotFoundError(`Trip not found: ${tripId}`, { tripId }, 'TRIP_NOT_FOUND');
    }
    // Domain-side gate: throws TRIP_ARCHIVED if archived ([F4]).
    assertCanUnlock(trip);
    if (trip.status === 'draft') return trip; // already-unlocked idempotency
    await this.trips.updateStatus(tripId, 'draft');
    return markUnlocked(trip);
  }
}
