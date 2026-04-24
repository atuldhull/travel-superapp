/**
 * Delete a review — author-only. Non-author and missing-id
 * both collapse to 404 `REVIEW_NOT_FOUND` (IDOR-safe).
 *
 * No admin-override verb in v1. A future moderation queue for
 * flagged reviews can land as its own admin surface without
 * touching this use-case.
 *
 * Installed by prompt [IV.18.12.5].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { REVIEW_REPOSITORY, type ReviewRepository } from './ports/review.repository';

export interface DeleteReviewCommand {
  readonly id: string;
  readonly authorId: string;
}

@Injectable()
export class DeleteReviewUseCase {
  constructor(@Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepository) {}

  async execute(cmd: DeleteReviewCommand): Promise<void> {
    const removed = await this.reviews.deleteForAuthor(cmd.id, cmd.authorId);
    if (!removed) {
      throw new NotFoundError(
        `Review not found: ${cmd.id}`,
        { reviewId: cmd.id },
        'REVIEW_NOT_FOUND',
      );
    }
  }
}
