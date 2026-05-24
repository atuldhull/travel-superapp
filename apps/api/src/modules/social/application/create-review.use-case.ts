/**
 * Post a review of a place / stay / eatery / agent. Review can
 * be standalone (tripId null) or trip-attached (tripId set —
 * then the trip-collab gate applies: author must own the trip
 * OR the trip must have an active share).
 *
 * Standalone reviews just need the caller to be authed. No gate
 * against the target itself — a user can review any catalogued
 * place regardless of whether they actually visited. A future
 * `verifiedBooking` flow can tighten this for booking-scoped
 * reviews (Stay via a real booking, Eatery via a reservation).
 *
 * [G4.1]: the 3 input invariants (rating ∈ [1,5], body 1..5000 after
 * trim, language ISO-639-1) moved onto `Review.create(input)`. The
 * use-case is now: gate (trip access + block) → `Review.create()` →
 * `repo.create()`.
 *
 * Installed by prompt [IV.18.12.5]; slimmed by [G4.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  TRIP_REPOSITORY,
  TRIP_SHARE_REPOSITORY,
  type TripRepository,
  type TripShareRepository,
} from '../../trip';

import { Review, type ReviewTargetType } from '../domain/review.entity';
import { assertCanVote as assertTripAccess } from './cast-vote.use-case';
import { REVIEW_REPOSITORY, type ReviewRepository } from './ports/review.repository';
import { BLOCK_REPOSITORY, type BlockRepository } from './ports/block.repository';
import { assertNotBlocked } from './block-user.use-case';

export interface CreateReviewCommand {
  readonly authorId: string;
  readonly tripId: string | null;
  readonly targetType: ReviewTargetType;
  readonly targetId: string;
  readonly rating: number;
  readonly body: string;
  readonly language: string;
}

@Injectable()
export class CreateReviewUseCase {
  constructor(
    @Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepository,
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(TRIP_SHARE_REPOSITORY) private readonly shares: TripShareRepository,
    @Inject(BLOCK_REPOSITORY) private readonly blocks: BlockRepository,
  ) {}

  async execute(cmd: CreateReviewCommand): Promise<Review> {
    // Domain-side invariant check + normalisation (R1/R2/R3 — [G4.1]).
    const input = Review.create(cmd);
    if (input.tripId !== null) {
      // Trip-attached reviews need the same collab access as
      // voting / expenses.
      await assertTripAccess(this.trips, this.shares, input.tripId, input.authorId);
      // POST.2B.1 — block gate alongside the access gate (the
      // trip-attached path; non-trip review targets are a later
      // refinement, same scope call as the anonymous-hearts N/A).
      const trip = await this.trips.findById(input.tripId);
      if (trip && trip.userId !== input.authorId) {
        await assertNotBlocked(this.blocks, input.authorId, trip.userId);
      }
    }
    return this.reviews.create(input);
  }
}
