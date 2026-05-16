/**
 * POST.2B.2 — unpublish a trip (owner-scoped, idempotent).
 *
 * Flips visibility → PRIVATE and clears the exposed geo +
 * publishedAt. POST.2C.2 — `setPrivate` now ALSO NULLs the pgvector
 * `embedding` in the SAME single SQL statement as the visibility
 * flip (atomic by construction — one UPDATE), so an unpublished trip
 * can never leave a ghost vector in discovery / agent grounding.
 * This use-case stays a thin owner-scoped delegate; the de-index
 * atomicity is enforced in the repository, not orchestrated here.
 *
 * Installed by prompt [POST.2B.2]; de-index seam realized [POST.2C.2].
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
