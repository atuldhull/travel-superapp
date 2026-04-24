/**
 * List every review on a given target (place / stay / eatery /
 * agent), most-recent-first. Public to all authed users — reviews
 * are crowd-sourced signal; restricting them to the author's
 * friends defeats the purpose.
 *
 * Default 50, cap 200. Pagination is follow-up; the two-index
 * shape on `(targetType, targetId)` makes it cheap either way.
 *
 * Installed by prompt [IV.18.12.5].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Review, ReviewTargetType } from '../domain/review.entity';
import { REVIEW_REPOSITORY, type ReviewRepository } from './ports/review.repository';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export interface ListReviewsForTargetCommand {
  readonly targetType: ReviewTargetType;
  readonly targetId: string;
  readonly limit?: number;
}

@Injectable()
export class ListReviewsForTargetUseCase {
  constructor(@Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepository) {}

  async execute(cmd: ListReviewsForTargetCommand): Promise<readonly Review[]> {
    const clamped =
      cmd.limit === undefined
        ? DEFAULT_LIMIT
        : Math.max(1, Math.min(MAX_LIMIT, Math.floor(cmd.limit)));
    return this.reviews.listByTarget({
      targetType: cmd.targetType,
      targetId: cmd.targetId,
      limit: clamped,
    });
  }
}
