/**
 * POST.2B.2 — publish a trip (owner-gated, privacy-fenced).
 *
 * Enforces INVARIANT A (trip must have ended) via the domain
 * `assertPublishable`, then computes the exposed location via the
 * domain `exposeGeo` (INVARIANT B) before persisting. Default
 * visibility = FOLLOWERS (decision D2 — PUBLIC needs an explicit
 * choice + a 2nd confirm at the UI layer).
 *
 * Trip center is read via GeoQueries (CLAUDE.md #11 — never touch
 * `Trip.center` directly).
 *
 * Installed by prompt [POST.2B.2].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { GeoQueries } from '../../../common/db/geo-queries';
import { TRIP_REPOSITORY, type TripRepository } from '../../trip/application/ports/trip.repository';
import {
  assertPublishable,
  exposeGeo,
  type TripPublication,
  type Visibility,
} from '../domain/trip-publication.entity';
import {
  TRIP_PUBLICATION_REPOSITORY,
  type TripPublicationRepository,
} from './ports/trip-publication.repository';

export interface PublishTripCommand {
  readonly tripId: string;
  readonly userId: string;
  /** Defaults to FOLLOWERS (D2). */
  readonly visibility?: Visibility;
  /** Only meaningful for FOLLOWERS — keep precise geo. */
  readonly preciseGeoOptIn?: boolean;
}

@Injectable()
export class PublishTripUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(GeoQueries) private readonly geo: GeoQueries,
    @Inject(TRIP_PUBLICATION_REPOSITORY)
    private readonly pubs: TripPublicationRepository,
  ) {}

  async execute(cmd: PublishTripCommand): Promise<TripPublication> {
    // Owner-gate: only the trip owner can publish it.
    const trip = await this.trips.findByIdForUser(cmd.tripId, cmd.userId);
    if (!trip) {
      throw new NotFoundError('Trip not found', { tripId: cmd.tripId }, 'TRIP_NOT_FOUND');
    }

    // INVARIANT A — must have definitively ended.
    assertPublishable(trip.endsOn, new Date());

    const visibility: Visibility = cmd.visibility ?? 'FOLLOWERS';
    const center = await this.geo.findTripCenter(cmd.tripId);

    // INVARIANT B — coarsen exposed location per visibility.
    const exposed = exposeGeo(
      center?.lat ?? null,
      center?.lng ?? null,
      visibility,
      cmd.preciseGeoOptIn ?? false,
    );

    return this.pubs.upsertPublish({
      tripId: cmd.tripId,
      authorId: cmd.userId,
      memoryBookId: null,
      visibility,
      exposedLat: exposed.lat,
      exposedLng: exposed.lng,
      publishedAt: new Date(),
    });
  }
}
