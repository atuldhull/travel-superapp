/**
 * V.UX.25 — class-based response DTOs for the karma + helpful-vote
 * surfaces. Documentation-only.
 *
 * Installed by prompt [V.UX.25].
 */
import { ApiProperty } from '@nestjs/swagger';

export class HelpfulVoteResponseDto {
  @ApiProperty({ format: 'cuid' })
  declare reviewId: string;

  @ApiProperty({ description: 'Total helpful votes after this call.' })
  declare helpfulCount: number;

  @ApiProperty({
    enum: ['inserted', 'duplicate'],
    description: 'inserted = first helpful vote from this voter; duplicate = re-click no-op.',
  })
  declare outcome: string;
}

export class UserKarmaDto {
  @ApiProperty({ format: 'cuid' })
  declare userId: string;

  @ApiProperty({ description: 'Computed karma score.' })
  declare score: number;

  @ApiProperty()
  declare reviewCount: number;

  @ApiProperty({ description: "Helpful-votes received across all of this user's reviews." })
  declare helpfulVotesReceived: number;

  @ApiProperty({
    type: [String],
    description: 'Badge slugs (e.g. "contributor_10", "helpful_100").',
  })
  declare badges: string[];

  @ApiProperty({ format: 'date-time' })
  declare recomputedAt: string;
}

export class PublicReviewerRecentReviewDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ enum: ['place', 'stay', 'eatery', 'agent'] })
  declare targetType: string;

  @ApiProperty()
  declare targetId: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  declare rating: number;

  @ApiProperty()
  declare body: string;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;
}

export class PublicReviewerProfileDto {
  @ApiProperty({ format: 'cuid' })
  declare userId: string;

  @ApiProperty()
  declare displayName: string;

  @ApiProperty({ type: UserKarmaDto })
  declare karma: UserKarmaDto;

  @ApiProperty({ type: [PublicReviewerRecentReviewDto] })
  declare recentReviews: PublicReviewerRecentReviewDto[];
}
