/**
 * Phase 5 (J1) — read the caller's publication status for one trip.
 *
 * Owner-gated: only the trip owner can inspect (and therefore manage)
 * its feed publication. Mirrors the owner-gate in PublishTripUseCase
 * (`findByIdForUser` → 404 when not the owner). The publish/unpublish
 * endpoints already existed; this read seam is what lets the web UI
 * render the current state instead of guessing.
 *
 * Returns `null` when the trip was never published. A trip that was
 * published then unpublished still has a `TripPublication` row, but
 * with `publishedAt: null` (see `setPrivate`) — the controller maps
 * `publishedAt !== null` to the user-facing "is it live" flag.
 *
 * Installed by prompt [J1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { TRIP_REPOSITORY, type TripRepository } from '../../trip/application/ports/trip.repository';
import type { TripPublication } from '../domain/trip-publication.entity';
import {
  TRIP_PUBLICATION_REPOSITORY,
  type TripPublicationRepository,
} from './ports/trip-publication.repository';

export interface GetTripPublicationQuery {
  readonly tripId: string;
  readonly userId: string;
}

@Injectable()
export class GetTripPublicationUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(TRIP_PUBLICATION_REPOSITORY)
    private readonly pubs: TripPublicationRepository,
  ) {}

  async execute(query: GetTripPublicationQuery): Promise<TripPublication | null> {
    // Owner-gate — a non-owner (or unknown trip) is indistinguishable
    // by design (existence-probe defence): both yield TRIP_NOT_FOUND.
    const trip = await this.trips.findByIdForUser(query.tripId, query.userId);
    if (!trip) {
      throw new NotFoundError('Trip not found', { tripId: query.tripId }, 'TRIP_NOT_FOUND');
    }
    return this.pubs.findByTrip(query.tripId);
  }
}
