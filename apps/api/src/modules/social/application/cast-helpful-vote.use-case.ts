/**
 * V.UX.25 — "I found this review helpful" upvote.
 *
 *   - Auth-gated at the controller; voter id stamped server-side.
 *   - 404 REVIEW_NOT_FOUND when the target review doesn't exist.
 *   - 403 HELPFUL_VOTE_SELF when the voter is the review's author.
 *   - 200 idempotent on re-vote (the unique index dedups; re-clicks
 *     return the current count without an error).
 *
 * On a fresh insert, the voter's own karma is unchanged but the
 * review-author's karma is recomputed inline so the new
 * `helpfulVotesReceived` count + any newly-qualifying badges are
 * visible immediately. The nightly `RecomputeKarmaUseCase`
 * tick still runs as a safety net.
 *
 * Installed by prompt [V.UX.25].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ForbiddenError, NotFoundError } from '@app/errors';
import {
  HELPFUL_VOTE_REPOSITORY,
  type HelpfulVoteRepository,
} from './ports/helpful-vote.repository';
import { KARMA_REPOSITORY, type KarmaRepository } from './ports/karma.repository';
import { REVIEW_REPOSITORY, type ReviewRepository } from './ports/review.repository';

export interface CastHelpfulVoteCommand {
  readonly voterId: string;
  readonly reviewId: string;
}

export interface CastHelpfulVoteResult {
  readonly reviewId: string;
  readonly helpfulCount: number;
  readonly outcome: 'inserted' | 'duplicate';
}

@Injectable()
export class CastHelpfulVoteUseCase {
  constructor(
    @Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepository,
    @Inject(HELPFUL_VOTE_REPOSITORY) private readonly votes: HelpfulVoteRepository,
    @Inject(KARMA_REPOSITORY) private readonly karma: KarmaRepository,
  ) {}

  async execute(cmd: CastHelpfulVoteCommand): Promise<CastHelpfulVoteResult> {
    const review = await this.reviews.findById(cmd.reviewId);
    if (!review) {
      throw new NotFoundError('Review not found', { reviewId: cmd.reviewId }, 'REVIEW_NOT_FOUND');
    }
    if (review.authorId === cmd.voterId) {
      throw new ForbiddenError(
        'Cannot helpful-vote your own review',
        { reviewId: cmd.reviewId, voterId: cmd.voterId },
        'HELPFUL_VOTE_SELF',
      );
    }

    const outcome = await this.votes.insertOnce({
      reviewId: cmd.reviewId,
      voterId: cmd.voterId,
    });

    if (outcome === 'inserted') {
      // Recompute karma for the review's author so the new helpful
      // count + any badge-cross is visible to the next read. Best-
      // effort — a transient failure here doesn't undo the vote
      // (the nightly tick will reconcile).
      await this.karma.recomputeForUser(review.authorId).catch(() => undefined);
    }

    const helpfulCount = await this.votes.countForReview(cmd.reviewId);
    return { reviewId: cmd.reviewId, helpfulCount, outcome };
  }
}
