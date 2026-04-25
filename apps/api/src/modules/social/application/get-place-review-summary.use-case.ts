/**
 * Composite read endpoint for the place detail page. Bundles
 * three existing Social aggregations into one round-trip:
 *
 *   - Review summary (`{ count, average, histogram }`)
 *   - Vote tally     (`{ up, meh, down, score }`)
 *   - Top N most-recent reviews (cap 5; full bodies + ratings
 *     for the "what people are saying" panel)
 *
 * No new persistence — pure orchestration over
 * `GetReviewSummaryUseCase`, `GetVoteSummaryUseCase`, and
 * `ListReviewsForTargetUseCase`. All three are imported via
 * `SocialModule.exports`. `Promise.all` so the composite
 * returns in roughly the slowest sub-fetch's time, not the
 * sum.
 *
 * The `placeId` is treated as opaque — we don't validate it
 * against the Place table here. Both review and vote summaries
 * already return zero-filled shapes for unknown targets
 * (`[IV.18.12.8]` / `[IV.18.12.9]`), and the route is
 * `@Public()` — 404-on-unknown-place would leak place-id
 * existence to strangers via the review surface.
 *
 * Installed by prompt [IV.18.12.11].
 */
import { Inject, Injectable } from '@nestjs/common';
import { GetReviewSummaryUseCase } from '../../social/application/get-review-summary.use-case';
import { GetVoteSummaryUseCase } from '../../social/application/get-vote-summary.use-case';
import { ListReviewsForTargetUseCase } from '../../social/application/list-reviews-for-target.use-case';
import type { ReviewSummary } from '../../social/application/ports/review.repository';
import type { VoteSummary } from '../../social/application/ports/vote.repository';
import type { Review } from '../../social/domain/review.entity';

const RECENT_REVIEWS_LIMIT = 5;

export interface PlaceReviewSummary {
  readonly placeId: string;
  readonly reviews: ReviewSummary;
  readonly votes: VoteSummary;
  readonly recentReviews: readonly Review[];
}

@Injectable()
export class GetPlaceReviewSummaryUseCase {
  constructor(
    @Inject(GetReviewSummaryUseCase)
    private readonly reviewSummary: GetReviewSummaryUseCase,
    @Inject(GetVoteSummaryUseCase)
    private readonly voteSummary: GetVoteSummaryUseCase,
    @Inject(ListReviewsForTargetUseCase)
    private readonly listReviews: ListReviewsForTargetUseCase,
  ) {}

  async execute(placeId: string): Promise<PlaceReviewSummary> {
    const [reviews, votes, recentReviews] = await Promise.all([
      this.reviewSummary.execute({ targetType: 'place', targetId: placeId }),
      this.voteSummary.execute({ targetType: 'place', targetId: placeId }),
      this.listReviews.execute({
        targetType: 'place',
        targetId: placeId,
        limit: RECENT_REVIEWS_LIMIT,
      }),
    ]);
    return { placeId, reviews, votes, recentReviews };
  }
}
