/**
 * POST.2B.2 — unpublish a trip (owner-scoped, idempotent).
 *
 * Flips visibility → PRIVATE and clears the exposed geo +
 * publishedAt. This is the seam POST.2C.2 extends to also NULL the
 * pgvector embedding in the SAME transaction (de-index on unpublish
 * — no ghost in discovery).
 *
 * Installed by prompt [POST.2B.2].
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  TRIP_PUBLICATION_REPOSITORY,
  type TripPublicationRepository,
} from './ports/trip-publication.repository';

export interface UnpublishTripCommand {
  readonly tripId: string;
  readonly userId: string;
}

@Injectable()
export class UnpublishTripUseCase {
  constructor(
    @Inject(TRIP_PUBLICATION_REPOSITORY)
    private readonly pubs: TripPublicationRepository,
  ) {}

  async execute(cmd: UnpublishTripCommand): Promise<void> {
    await this.pubs.setPrivate(cmd.tripId, cmd.userId);
  }
}
