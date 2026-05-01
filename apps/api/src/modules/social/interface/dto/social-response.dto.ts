/**
 * Class-based response DTOs for the Social HTTP surfaces (reviews,
 * votes, expenses, vote tallies, review-bundle composites).
 * Documentation-only.
 *
 * Installed by prompt [IV.18.19.67].
 */
import { ApiProperty } from '@nestjs/swagger';

// ─── Reviews ─────────────────────────────────────────────────────

export class CreateReviewRequestDto {
  @ApiProperty({ required: false, format: 'cuid', nullable: true })
  declare tripId?: string | null;

  @ApiProperty({ enum: ['place', 'stay', 'eatery', 'agent'] })
  declare targetType: string;

  @ApiProperty({ description: 'Id of the review target.' })
  declare targetId: string;

  @ApiProperty({ description: '1..5 rating.' })
  declare rating: number;

  @ApiProperty({ description: 'Free-form review body.' })
  declare body: string;

  @ApiProperty({ required: false, description: 'BCP-47 language tag (default "en").' })
  declare language?: string;
}

export class RespondToReviewRequestDto {
  @ApiProperty({
    description: "Agent's reply (1..2000 chars). Stamped at most once per review.",
    minLength: 1,
    maxLength: 2000,
  })
  declare responseBody: string;
}

export class ReviewDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ format: 'cuid' })
  declare authorId: string;

  @ApiProperty({ nullable: true, format: 'cuid' })
  declare tripId: string | null;

  @ApiProperty({ enum: ['place', 'stay', 'eatery', 'agent'] })
  declare targetType: string;

  @ApiProperty()
  declare targetId: string;

  @ApiProperty()
  declare rating: number;

  @ApiProperty()
  declare body: string;

  @ApiProperty()
  declare language: string;

  @ApiProperty()
  declare verifiedBooking: boolean;

  @ApiProperty({
    nullable: true,
    description: 'V.UX.24 — agent reply on this review (one-shot).',
  })
  declare responseBody: string | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  declare responseAt: string | null;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;

  @ApiProperty({ format: 'date-time' })
  declare updatedAt: string;
}

export class ReviewSummaryDto {
  @ApiProperty({ enum: ['place', 'stay', 'eatery', 'agent'] })
  declare targetType: string;

  @ApiProperty()
  declare targetId: string;

  @ApiProperty({ description: 'Number of reviews on the target.' })
  declare count: number;

  @ApiProperty({ description: 'Mean rating, two-decimal-rounded.' })
  declare average: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    description: 'Histogram keyed by rating bucket ("1".."5") → count.',
  })
  declare histogram: Record<string, number>;
}

export class ListReviewsResponseDto {
  @ApiProperty({ type: [ReviewDto] })
  declare reviews: ReviewDto[];
}

// ─── Votes ───────────────────────────────────────────────────────

export class CastVoteRequestDto {
  @ApiProperty({ enum: ['itinerary_item', 'place', 'restaurant'] })
  declare targetType: string;

  @ApiProperty()
  declare targetId: string;

  @ApiProperty({ description: 'Vote value: -1 (down), 0 (meh), +1 (up).' })
  declare value: number;
}

export class RevokeVoteRequestDto {
  @ApiProperty({ enum: ['itinerary_item', 'place', 'restaurant'] })
  declare targetType: string;

  @ApiProperty()
  declare targetId: string;
}

export class VoteDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ format: 'cuid' })
  declare tripId: string;

  @ApiProperty({ enum: ['itinerary_item', 'place', 'restaurant'] })
  declare targetType: string;

  @ApiProperty()
  declare targetId: string;

  @ApiProperty()
  declare value: number;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;
}

export class VoteTallyDto {
  @ApiProperty({ enum: ['itinerary_item', 'place', 'restaurant'] })
  declare targetType: string;

  @ApiProperty()
  declare targetId: string;

  @ApiProperty()
  declare up: number;

  @ApiProperty()
  declare meh: number;

  @ApiProperty()
  declare down: number;

  @ApiProperty({ description: 'Composite score (up - down).' })
  declare score: number;

  @ApiProperty({
    nullable: true,
    description: "Caller's own vote value on this target, or null if none.",
  })
  declare ownVote: number | null;
}

export class VoteSummaryDto {
  @ApiProperty()
  declare targetType: string;

  @ApiProperty()
  declare targetId: string;

  @ApiProperty()
  declare up: number;

  @ApiProperty()
  declare meh: number;

  @ApiProperty()
  declare down: number;

  @ApiProperty()
  declare score: number;
}

export class ListTripVotesResponseDto {
  @ApiProperty({ type: [VoteTallyDto] })
  declare tallies: VoteTallyDto[];
}

// ─── Expenses ────────────────────────────────────────────────────

export class CreateExpenseRequestDto {
  @ApiProperty({ description: 'Decimal string in USD (e.g. "12.50").' })
  declare amountUsd: string;

  @ApiProperty({ description: 'ISO-4217 currency code of the original charge.' })
  declare currency: string;

  @ApiProperty({ required: false, nullable: true })
  declare note?: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    description: 'Map of userId → split share. Sum must be ~1.0.',
  })
  declare splitShare: Record<string, number>;
}

export class ExpenseDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ format: 'cuid' })
  declare tripId: string;

  @ApiProperty({ format: 'cuid' })
  declare paidById: string;

  @ApiProperty({ description: 'Decimal string USD.' })
  declare amountUsd: string;

  @ApiProperty()
  declare currency: string;

  @ApiProperty({ nullable: true })
  declare note: string | null;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  declare splitShare: Record<string, number>;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;

  @ApiProperty({ format: 'date-time' })
  declare updatedAt: string;
}

export class ListExpensesResponseDto {
  @ApiProperty({ type: [ExpenseDto] })
  declare expenses: ExpenseDto[];
}

export class UserBalanceDto {
  @ApiProperty({ format: 'cuid' })
  declare userId: string;

  @ApiProperty({
    description:
      'Net USD as a decimal string. Positive = owed; negative = owes. Sum across the array is zero modulo 2dp rounding.',
  })
  declare netUsd: string;
}

export class ListBalancesResponseDto {
  @ApiProperty({ type: [UserBalanceDto], description: 'Sorted largest-creditor-first.' })
  declare balances: UserBalanceDto[];
}

/**
 * V.UX.8 settle-up suggestion. One transfer = one user pays another a
 * fixed USD amount. The full list zeros the ledger; expect ≤ K-1
 * transfers for K non-zero balance holders.
 *
 * Installed by prompt [V.UX.8].
 */
export class SettleTransferDto {
  @ApiProperty({ format: 'cuid', description: 'User who pays.' })
  declare fromUserId: string;

  @ApiProperty({ format: 'cuid', description: 'User who receives.' })
  declare toUserId: string;

  @ApiProperty({ description: 'USD as 2dp string ("12.50").' })
  declare amountUsd: string;
}

export class SettleUpResponseDto {
  @ApiProperty({
    type: [SettleTransferDto],
    description:
      'Greedy minimum-cashflow transfer plan. ≤ K-1 transfers for K non-zero balance holders.',
  })
  declare transfers: SettleTransferDto[];
}

/**
 * V.UX.10 anonymous reactions on shared trips. Counts are durable
 * (no TTL). Per-IP rate-limited at the route level.
 */
export class HeartSharedTripResponseDto {
  @ApiProperty({ format: 'cuid', description: 'The trip the heart was applied to.' })
  declare tripId: string;

  @ApiProperty({ description: 'Heart count after this increment.' })
  declare hearts: number;
}

export class SharedTripHeartCountResponseDto {
  @ApiProperty({ format: 'cuid' })
  declare tripId: string;

  @ApiProperty({ description: 'Current heart count.' })
  declare hearts: number;
}

// ─── Review bundle composite ─────────────────────────────────────

export class RecentReviewDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ format: 'cuid' })
  declare authorId: string;

  @ApiProperty()
  declare rating: number;

  @ApiProperty()
  declare body: string;

  @ApiProperty()
  declare language: string;

  @ApiProperty()
  declare verifiedBooking: boolean;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;
}

export class ReviewBundleReviewsDto {
  @ApiProperty()
  declare count: number;

  @ApiProperty()
  declare average: number;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  declare histogram: Record<string, number>;
}

export class ReviewBundleVotesDto {
  @ApiProperty()
  declare up: number;

  @ApiProperty()
  declare meh: number;

  @ApiProperty()
  declare down: number;

  @ApiProperty()
  declare score: number;
}

export class PlaceReviewSummaryResponseDto {
  @ApiProperty({ format: 'cuid' })
  declare placeId: string;

  @ApiProperty({ type: ReviewBundleReviewsDto })
  declare reviews: ReviewBundleReviewsDto;

  @ApiProperty({ type: ReviewBundleVotesDto })
  declare votes: ReviewBundleVotesDto;

  @ApiProperty({ type: [RecentReviewDto] })
  declare recentReviews: RecentReviewDto[];
}

export class StayReviewSummaryResponseDto {
  @ApiProperty()
  declare stayId: string;

  @ApiProperty({ type: ReviewBundleReviewsDto })
  declare reviews: ReviewBundleReviewsDto;

  @ApiProperty({ type: ReviewBundleVotesDto })
  declare votes: ReviewBundleVotesDto;

  @ApiProperty({ type: [RecentReviewDto] })
  declare recentReviews: RecentReviewDto[];
}

export class EateryReviewSummaryResponseDto {
  @ApiProperty()
  declare eateryId: string;

  @ApiProperty({ type: ReviewBundleReviewsDto })
  declare reviews: ReviewBundleReviewsDto;

  @ApiProperty({ type: ReviewBundleVotesDto })
  declare votes: ReviewBundleVotesDto;

  @ApiProperty({ type: [RecentReviewDto] })
  declare recentReviews: RecentReviewDto[];
}

export class AgentReviewSummaryResponseDto {
  @ApiProperty({ format: 'cuid' })
  declare agentId: string;

  @ApiProperty({ type: ReviewBundleReviewsDto })
  declare reviews: ReviewBundleReviewsDto;

  @ApiProperty({ type: ReviewBundleVotesDto })
  declare votes: ReviewBundleVotesDto;

  @ApiProperty({ type: [RecentReviewDto] })
  declare recentReviews: RecentReviewDto[];
}
