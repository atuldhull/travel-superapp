/**
 * Aggregate every review on a given target into the consumer
 * shape `{ count, average, histogram }`. Drives the rating
 * widget on every place / stay / eatery / agent detail page —
 * without it, clients have to fetch the full review list and
 * aggregate in JS, which doesn't scale past a few thousand
 * reviews.
 *
 * Empty target → `{ count: 0, average: 0, histogram: all-zeros }`
 * — NOT a 404. Aggregation of zero rows is a valid response, and
 * the route is `@Public()` so we don't want to leak target
 * existence either way.
 *
 * Public-readable: review summaries are crowd signal and contain
 * no PII. Same precedent as published memory book reads.
 *
 * Installed by prompt [IV.18.12.8].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { ReviewTargetType } from '../domain/review.entity';
import {
  REVIEW_REPOSITORY,
  type ReviewRepository,
  type ReviewSummary,
} from './ports/review.repository';

export interface GetReviewSummaryCommand {
  readonly targetType: ReviewTargetType;
  readonly targetId: string;
}

@Injectable()
export class GetReviewSummaryUseCase {
  constructor(@Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepository) {}

  async execute(cmd: GetReviewSummaryCommand): Promise<ReviewSummary> {
    return this.reviews.aggregateByTarget(cmd.targetType, cmd.targetId);
  }
}
