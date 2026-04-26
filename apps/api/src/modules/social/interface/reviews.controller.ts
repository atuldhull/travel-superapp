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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthenticatedUser, CurrentUser, Public } from '../../../common/auth';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CreateReviewUseCase } from '../application/create-review.use-case';
import { DeleteReviewUseCase } from '../application/delete-review.use-case';
import { GetReviewSummaryUseCase } from '../application/get-review-summary.use-case';
import { ListMyReviewsUseCase } from '../application/list-my-reviews.use-case';
import { ListReviewsForTargetUseCase } from '../application/list-reviews-for-target.use-case';
import type { Review, ReviewTargetType } from '../domain/review.entity';
import type { ReviewSummary } from '../application/ports/review.repository';
import {
  CreateReviewBodySchema,
  ReviewTargetTypeSchema,
  type CreateReviewBody,
} from './dto/social.dto';

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
  ) {}

  @ApiOperation({
    summary:
      'Create a review for any review-target (place/stay/eatery/agent). Owner-stamped to the caller.',
  })
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
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.deleteUc.execute({ id, authorId: user.sub });
  }
}
