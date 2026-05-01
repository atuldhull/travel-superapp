/**
 * Reviews HTTP surface. Top-level (not trip-scoped) because
 * reviews can be standalone — attached to a trip via body.tripId
 * when collaborative context matters, absent for solo "this
 * place was great" reviews.
 *
 *   POST   /api/v1/reviews                         create a review
 *   GET    /api/v1/reviews?targetType=&targetId=   list reviews on a target (public to authed)
 *   GET    /api/v1/reviews/mine                    list caller's own reviews
 *   DELETE /api/v1/reviews/:id                     author-only delete
 *
 * Install by prompt [IV.18.12.5].
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  CreateReviewRequestDto,
  ListReviewsResponseDto,
  ReviewDto as ReviewResponseDto,
  ReviewSummaryDto as ReviewSummaryResponseDto,
} from './dto/social-response.dto';
import { type AuthenticatedUser, CurrentUser, Public } from '../../../common/auth';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CastHelpfulVoteUseCase } from '../application/cast-helpful-vote.use-case';
import { CreateReviewUseCase } from '../application/create-review.use-case';
import { DeleteReviewUseCase } from '../application/delete-review.use-case';
import { GetReviewSummaryUseCase } from '../application/get-review-summary.use-case';
import { ListMyReviewsUseCase } from '../application/list-my-reviews.use-case';
import { ListReviewsForTargetUseCase } from '../application/list-reviews-for-target.use-case';
import { RespondToReviewUseCase } from '../application/respond-to-review.use-case';
import { HelpfulVoteResponseDto } from './dto/karma-response.dto';
import type { Review, ReviewTargetType } from '../domain/review.entity';
import type { ReviewSummary } from '../application/ports/review.repository';
import {
  CreateReviewBodySchema,
  RespondToReviewBodySchema,
  ReviewTargetTypeSchema,
  type CreateReviewBody,
  type RespondToReviewBody,
} from './dto/social.dto';
import { Roles } from '../../../common/auth';
import { RespondToReviewRequestDto } from './dto/social-response.dto';

interface ReviewDto {
  readonly id: string;
  readonly authorId: string;
  readonly tripId: string | null;
  readonly targetType: string;
  readonly targetId: string;
  readonly rating: number;
  readonly body: string;
  readonly language: string;
  readonly verifiedBooking: boolean;
  readonly responseBody: string | null;
  readonly responseAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function toDto(r: Review): ReviewDto {
  return {
    id: r.id,
    authorId: r.authorId,
    tripId: r.tripId,
    targetType: r.targetType,
    targetId: r.targetId,
    rating: r.rating,
    body: r.body,
    language: r.language,
    verifiedBooking: r.verifiedBooking,
    responseBody: r.responseBody,
    responseAt: r.responseAt === null ? null : r.responseAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

interface ReviewSummaryDto {
  readonly targetType: string;
  readonly targetId: string;
  readonly count: number;
  readonly average: number;
  readonly histogram: Readonly<Record<string, number>>;
}

function summaryToDto(s: ReviewSummary): ReviewSummaryDto {
  return {
    targetType: s.targetType,
    targetId: s.targetId,
    count: s.count,
    average: s.average,
    histogram: s.histogram as unknown as Readonly<Record<string, number>>,
  };
}

@ApiTags('social')
@ApiBearerAuth()
@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly createUc: CreateReviewUseCase,
    private readonly listTargetUc: ListReviewsForTargetUseCase,
    private readonly listMineUc: ListMyReviewsUseCase,
    private readonly deleteUc: DeleteReviewUseCase,
    private readonly summaryUc: GetReviewSummaryUseCase,
    private readonly respondUc: RespondToReviewUseCase,
    private readonly helpfulUc: CastHelpfulVoteUseCase,
  ) {}

  @ApiOperation({
    summary:
      'Create a review for any review-target (place/stay/eatery/agent). Owner-stamped to the caller.',
  })
  @ApiBody({ type: CreateReviewRequestDto })
  @ApiResponse({ status: 201, description: 'Newly-created review row.', type: ReviewResponseDto })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(CreateReviewBodySchema)) body: CreateReviewBody,
  ): Promise<ReviewDto> {
    const review = await this.createUc.execute({
      authorId: user.sub,
      tripId: body.tripId ?? null,
      targetType: body.targetType,
      targetId: body.targetId,
      rating: body.rating,
      body: body.body,
      language: body.language ?? 'en',
    });
    return toDto(review);
  }

  /**
   * Aggregated rating summary for a target. `@Public()` — review
   * summaries are public crowd-signal, no auth needed. Empty
   * target → 200 with zero-filled shape (not 404).
   *
   * Declared BEFORE `@Get()` (which uses query params) and
   * `@Get(':id')` would be — Nest matches in declaration order, so
   * the literal `summary` segment lands here cleanly.
   *
   * Installed by [IV.18.12.8].
   */
  @ApiOperation({
    summary: 'Aggregated review summary { count, average, histogram } for a target. @Public.',
  })
  @ApiResponse({
    status: 200,
    description: 'Summary; zero-filled for empty targets.',
    type: ReviewSummaryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'VALIDATION_FAILED — targetType / targetId missing or invalid.',
  })
  @Get('summary')
  @Public()
  @HttpCode(HttpStatus.OK)
  async summary(
    @Query('targetType') targetType?: string,
    @Query('targetId') targetId?: string,
  ): Promise<ReviewSummaryDto> {
    if (!targetType || !targetId) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'targetType and targetId query params are required',
      });
    }
    const parsed = ReviewTargetTypeSchema.safeParse(targetType);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'targetType must be one of: place | stay | eatery | agent',
      });
    }
    const result = await this.summaryUc.execute({
      targetType: parsed.data as ReviewTargetType,
      targetId,
    });
    return summaryToDto(result);
  }

  /**
   * Listing ordering: two routes in one controller slot. `mine`
   * wins before `/:id/…` because Nest routes are matched in
   * declaration order — kept `mine` first for clarity.
   */
  @ApiOperation({
    summary:
      "List the caller's authored reviews, most-recent-first. ?limit=N (1..200, default 50).",
  })
  @ApiResponse({ status: 200, description: "Caller's reviews.", type: ListReviewsResponseDto })
  @Get('mine')
  @HttpCode(HttpStatus.OK)
  async listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ): Promise<{ reviews: ReviewDto[] }> {
    const parsed = limit ? Math.max(1, Math.min(200, Number(limit) || 50)) : undefined;
    const reviews = await this.listMineUc.execute(user.sub, parsed);
    return { reviews: reviews.map(toDto) };
  }

  /**
   * Target-scoped listing. Query-param-driven instead of path-param
   * so a single controller handles every targetType without a
   * route explosion (`/places/:id/reviews`, `/stays/:id/reviews`
   * …). Clients pick the targetType string the API exposes.
   */
  @ApiOperation({
    summary: 'Target-scoped review listing. ?targetType + ?targetId required. Most-recent-first.',
  })
  @ApiResponse({ status: 200, description: 'Reviews on the target.', type: ListReviewsResponseDto })
  @ApiResponse({
    status: 400,
    description: 'VALIDATION_FAILED — targetType / targetId missing or invalid.',
  })
  @Get()
  @HttpCode(HttpStatus.OK)
  async listForTarget(
    @Query('targetType') targetType?: string,
    @Query('targetId') targetId?: string,
    @Query('limit') limit?: string,
  ): Promise<{ reviews: ReviewDto[] }> {
    if (!targetType || !targetId) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'targetType and targetId query params are required',
      });
    }
    const parsed = ReviewTargetTypeSchema.safeParse(targetType);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'targetType must be one of: place | stay | eatery | agent',
      });
    }
    const parsedLimit = limit ? Math.max(1, Math.min(200, Number(limit) || 50)) : undefined;
    const reviews = await this.listTargetUc.execute({
      targetType: parsed.data as ReviewTargetType,
      targetId,
      ...(parsedLimit !== undefined ? { limit: parsedLimit } : {}),
    });
    return { reviews: reviews.map(toDto) };
  }

  @ApiOperation({
    summary: "Delete one of the caller's reviews. Author-gated; 404 on cross-user / missing.",
  })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @ApiResponse({ status: 404, description: 'REVIEW_NOT_FOUND.' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.deleteUc.execute({ id, authorId: user.sub });
  }

  /**
   * V.UX.24 — agent (target-owner) reply on a review about themselves.
   * One-shot: a re-submit gets 409 REVIEW_RESPONSE_LOCKED. Caller must
   * hold the agent role; non-agent targets get 403.
   */
  @ApiOperation({
    summary:
      'Agent reply to a review (one-shot). 403 if the review is not about the caller; 409 on re-submit.',
  })
  @ApiBody({ type: RespondToReviewRequestDto })
  @ApiResponse({ status: 200, description: 'Updated review row.', type: ReviewResponseDto })
  @ApiResponse({ status: 404, description: 'REVIEW_NOT_FOUND | AGENT_PROFILE_NOT_FOUND.' })
  @ApiResponse({ status: 403, description: 'REVIEW_RESPONSE_FORBIDDEN | ROLE_FORBIDDEN.' })
  @ApiResponse({ status: 409, description: 'REVIEW_RESPONSE_LOCKED.' })
  @ApiResponse({ status: 422, description: 'INVALID_REVIEW_RESPONSE.' })
  @Roles('agent', 'admin')
  @Post(':id/response')
  @HttpCode(HttpStatus.OK)
  async respond(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RespondToReviewBodySchema)) body: RespondToReviewBody,
  ): Promise<ReviewDto> {
    const updated = await this.respondUc.execute({
      userId: user.sub,
      reviewId: id,
      responseBody: body.responseBody,
    });
    return toDto(updated);
  }

  /**
   * V.UX.25 — community "found this review helpful" upvote.
   * Idempotent — re-clicks return the current count without an
   * error. Self-vote rejected with 403 HELPFUL_VOTE_SELF.
   */
  @ApiOperation({
    summary:
      "Mark a review as helpful. Idempotent (re-vote returns the current count). Author can't self-vote.",
  })
  @ApiResponse({
    status: 200,
    description: 'Helpful count after the vote.',
    type: HelpfulVoteResponseDto,
  })
  @ApiResponse({ status: 404, description: 'REVIEW_NOT_FOUND.' })
  @ApiResponse({ status: 403, description: 'HELPFUL_VOTE_SELF.' })
  @Post(':id/helpful')
  @HttpCode(HttpStatus.OK)
  async helpful(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<HelpfulVoteResponseDto> {
    const result = await this.helpfulUc.execute({ voterId: user.sub, reviewId: id });
    return {
      reviewId: result.reviewId,
      helpfulCount: result.helpfulCount,
      outcome: result.outcome,
    };
  }
}
