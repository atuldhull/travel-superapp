/**
 * Shared DTO mapping for the review-bundle composite (used by
 * both `PlaceReviewSummaryController` and
 * `StayReviewSummaryController`). Each controller wraps the
 * shared shape with its resource-specific id field
 * (`placeId` / `stayId`) so the wire shape feels first-class
 * for each resource.
 *
 * Installed by prompt [IV.18.6.5].
 */
import type { ReviewBundle } from '../../application/get-review-bundle-for-target.use-case';

export interface ReviewBundleResponseDto {
  readonly reviews: {
    readonly count: number;
    readonly average: number;
    readonly histogram: Readonly<Record<string, number>>;
  };
  readonly votes: {
    readonly up: number;
    readonly meh: number;
    readonly down: number;
    readonly score: number;
  };
  readonly recentReviews: ReadonlyArray<{
    readonly id: string;
    readonly authorId: string;
    readonly rating: number;
    readonly body: string;
    readonly language: string;
    readonly verifiedBooking: boolean;
    readonly createdAt: string;
  }>;
}

export function reviewBundleToDto(b: ReviewBundle): ReviewBundleResponseDto {
  return {
    reviews: {
      count: b.reviews.count,
      average: b.reviews.average,
      histogram: b.reviews.histogram as unknown as Readonly<Record<string, number>>,
    },
    votes: {
      up: b.votes.up,
      meh: b.votes.meh,
      down: b.votes.down,
      score: b.votes.score,
    },
    recentReviews: b.recentReviews.map((r) => ({
      id: r.id,
      authorId: r.authorId,
      rating: r.rating,
      body: r.body,
      language: r.language,
      verifiedBooking: r.verifiedBooking,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
