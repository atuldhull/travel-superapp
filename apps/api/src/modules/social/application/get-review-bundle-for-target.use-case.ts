/**
 * Generalized composite read for any review-target resource
 * (place / stay / eatery / agent). Bundles three Social
 * aggregations into one round-trip:
 *
 *   - Review summary (`{ count, average, histogram }`)
 *   - Vote tally     (`{ up, meh, down, score }`)
 *   - Top N most-recent reviews (cap 5; full bodies + ratings
 *     for the "what people are saying" panel)
 *
 * No new persistence — pure orchestration over
 * `GetReviewSummaryUseCase`, `GetVoteSummaryUseCase`, and
 * `ListReviewsForTargetUseCase`. `Promise.all` so the composite
 * returns in roughly the slowest sub-fetch's time, not the sum.
 *
 * **Vote / review target-type mismatch.** Reviews allow the full
 * 4-set (`place | stay | eatery | agent`); votes today only
 * allow `place | restaurant | itinerary_item` per the schema. We
 * map: `place` → vote `place`; everything else returns a
 * zero-filled vote summary without hitting the votes table at
 * all. As stay / eatery / agent voting becomes a thing, extend
 * the map.
 *
 * The `targetId` is treated as opaque — we don't validate it
 * against the corresponding catalog table. Both review and vote
 * summaries already return zero-filled shapes for unknown
 * targets, and consumer routes are `@Public()` — 404-on-unknown
 * would leak target-id existence to strangers.
 *
 * Installed by prompt [IV.18.12.11] (place); generalized in
 * [IV.18.6.5] (stay).
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Review, ReviewTargetType } from '../domain/review.entity';
import type { VoteTargetType } from '../domain/vote.entity';
import { GetReviewSummaryUseCase } from './get-review-summary.use-case';
import { GetVoteSummaryUseCase } from './get-vote-summary.use-case';
import { ListReviewsForTargetUseCase } from './list-reviews-for-target.use-case';
import type { ReviewSummary } from './ports/review.repository';
import type { VoteSummary } from './ports/vote.repository';

const RECENT_REVIEWS_LIMIT = 5;

/**
 * Maps a review target type to the corresponding vote target
 * type, or `null` when no vote-target equivalent exists. Today
 * only `place` has a vote analogue — stay/eatery/agent return
 * zero-filled vote summaries. Extend as voting opens up to
 * other resources.
 */
function reviewToVoteTargetType(t: ReviewTargetType): VoteTargetType | null {
  return t === 'place' ? 'place' : null;
}

function emptyVoteSummary(targetType: ReviewTargetType, targetId: string): VoteSummary {
  return {
    targetType: 'place', // dummy; the controller layer doesn't expose this for non-place
    targetId,
    up: 0,
    meh: 0,
    down: 0,
    score: 0,
  } as VoteSummary;
}

export interface ReviewBundle {
  readonly targetType: ReviewTargetType;
  readonly targetId: string;
  readonly reviews: ReviewSummary;
  readonly votes: VoteSummary;
  readonly recentReviews: readonly Review[];
}

@Injectable()
export class GetReviewBundleForTargetUseCase {
  constructor(
    @Inject(GetReviewSummaryUseCase)
    private readonly reviewSummary: GetReviewSummaryUseCase,
    @Inject(GetVoteSummaryUseCase)
    private readonly voteSummary: GetVoteSummaryUseCase,
    @Inject(ListReviewsForTargetUseCase)
    private readonly listReviews: ListReviewsForTargetUseCase,
  ) {}

  async execute(targetType: ReviewTargetType, targetId: string): Promise<ReviewBundle> {
    const voteTargetType = reviewToVoteTargetType(targetType);
    const [reviews, votes, recentReviews] = await Promise.all([
      this.reviewSummary.execute({ targetType, targetId }),
      voteTargetType !== null
        ? this.voteSummary.execute({ targetType: voteTargetType, targetId })
        : Promise.resolve(emptyVoteSummary(targetType, targetId)),
      this.listReviews.execute({
        targetType,
        targetId,
        limit: RECENT_REVIEWS_LIMIT,
      }),
    ]);
    return { targetType, targetId, reviews, votes, recentReviews };
  }
}
