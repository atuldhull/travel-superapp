/**
 * V.UX.25 — public reviewer profile surface.
 *
 *   GET /api/v1/users/:userId/profile
 *     200 → PublicReviewerProfileDto
 *     404 → USER_NOT_FOUND  (deleted users included)
 *
 * `@Public()` — community signal is the same shape for signed-in
 * and anonymous viewers. Karma + recent reviews are the same data
 * a place / stay review-summary endpoint exposes.
 *
 * Installed by prompt [V.UX.25].
 */
import { Controller, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/auth';
import { GetPublicReviewerProfileUseCase } from '../application/get-public-reviewer-profile.use-case';
import type { PublicReviewerProfile } from '../domain/karma.entity';
import { PublicReviewerProfileDto } from './dto/karma-response.dto';

@ApiTags('social')
@Controller('users')
export class PublicUserProfileController {
  constructor(private readonly getProfile: GetPublicReviewerProfileUseCase) {}

  @ApiOperation({
    summary: 'Public reviewer profile: karma + badges + recent reviews. Public; no auth required.',
  })
  @ApiParam({ name: 'userId', format: 'cuid' })
  @ApiResponse({ status: 200, description: 'Profile bundle.', type: PublicReviewerProfileDto })
  @ApiResponse({ status: 404, description: 'USER_NOT_FOUND (or soft-deleted).' })
  @Public()
  @Get(':userId/profile')
  @HttpCode(HttpStatus.OK)
  async profile(@Param('userId') userId: string): Promise<PublicReviewerProfileDto> {
    const p = await this.getProfile.execute({ userId });
    return toDto(p);
  }
}

function toDto(p: PublicReviewerProfile): PublicReviewerProfileDto {
  return {
    userId: p.userId,
    displayName: p.displayName,
    karma: {
      userId: p.karma.userId,
      score: p.karma.score,
      reviewCount: p.karma.reviewCount,
      helpfulVotesReceived: p.karma.helpfulVotesReceived,
      badges: [...p.karma.badges],
      recomputedAt: p.karma.recomputedAt.toISOString(),
    },
    recentReviews: p.recentReviews.map((r) => ({
      id: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      rating: r.rating,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
    })),
  } satisfies PublicReviewerProfileDto;
}
