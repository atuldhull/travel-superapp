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
 * Validation:
 *   - `rating` ∈ [1, 5] integer.
 *   - `body` non-empty, ≤ 5000 chars (reasonable ceiling — longer
 *     reviews are blog posts, not reviews).
 *   - `language` exactly 2 lowercase ISO-639-1 letters.
 *
 * Installed by prompt [IV.18.12.5].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '@app/errors';
import { TRIP_REPOSITORY, type TripRepository } from '../../trip/application/ports/trip.repository';
import {
  TRIP_SHARE_REPOSITORY,
  type TripShareRepository,
} from '../../trip/application/ports/trip-share.repository';
import type { Review, ReviewTargetType } from '../domain/review.entity';
import { assertCanVote as assertTripAccess } from './cast-vote.use-case';
import { REVIEW_REPOSITORY, type ReviewRepository } from './ports/review.repository';
import { BLOCK_REPOSITORY, type BlockRepository } from './ports/block.repository';
import { assertNotBlocked } from './block-user.use-case';

const LANGUAGE_REGEX = /^[a-z]{2}$/;

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
    this.validate(cmd);
    if (cmd.tripId !== null) {
      // Trip-attached reviews need the same collab access as
      // voting / expenses.
      await assertTripAccess(this.trips, this.shares, cmd.tripId, cmd.authorId);
      // POST.2B.1 — block gate alongside the access gate (the
      // trip-attached path; non-trip review targets are a later
      // refinement, same scope call as the anonymous-hearts N/A).
      const trip = await this.trips.findById(cmd.tripId);
      if (trip && trip.userId !== cmd.authorId) {
        await assertNotBlocked(this.blocks, cmd.authorId, trip.userId);
      }
    }
    return this.reviews.create({
      authorId: cmd.authorId,
      tripId: cmd.tripId,
      targetType: cmd.targetType,
      targetId: cmd.targetId,
      rating: cmd.rating,
      body: cmd.body.trim(),
      language: cmd.language.toLowerCase(),
    });
  }

  private validate(cmd: CreateReviewCommand): void {
    if (!Number.isInteger(cmd.rating) || cmd.rating < 1 || cmd.rating > 5) {
      throw new ValidationError(
        'Rating must be an integer between 1 and 5',
        { rating: ['must be integer in [1, 5]'] },
        { rating: cmd.rating },
        'INVALID_RATING',
      );
    }
    const bodyTrimmed = cmd.body.trim();
    if (bodyTrimmed.length === 0) {
      throw new ValidationError(
        'Review body cannot be empty',
        { body: ['must be non-empty'] },
        {},
        'INVALID_REVIEW_BODY',
      );
    }
    if (bodyTrimmed.length > 5000) {
      throw new ValidationError(
        'Review body too long',
        { body: [`must be ≤ 5000 chars (got ${bodyTrimmed.length})`] },
        { length: bodyTrimmed.length },
        'INVALID_REVIEW_BODY',
      );
    }
    if (!LANGUAGE_REGEX.test(cmd.language.toLowerCase())) {
      throw new ValidationError(
        'Language must be a 2-letter ISO 639-1 code',
        { language: ['must be 2 lowercase letters'] },
        { language: cmd.language },
        'INVALID_LANGUAGE',
      );
    }
  }
}
