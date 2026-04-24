/**
 * List the authed user's own reviews, most-recent-first.
 * Default 50, cap 200.
 *
 * Installed by prompt [IV.18.12.5].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Review } from '../domain/review.entity';
import { REVIEW_REPOSITORY, type ReviewRepository } from './ports/review.repository';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

@Injectable()
export class ListMyReviewsUseCase {
  constructor(@Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepository) {}

  async execute(authorId: string, limit?: number): Promise<readonly Review[]> {
    const clamped =
      limit === undefined ? DEFAULT_LIMIT : Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit)));
    return this.reviews.listByAuthor(authorId, clamped);
  }
}
