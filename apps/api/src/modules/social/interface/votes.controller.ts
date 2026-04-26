/**
 * Top-level Votes HTTP surface — separate from the trip-scoped
 * `SocialController` (mounted at `/trips/:tripId/votes`) because
 * the summary aggregates across every trip the target appears
 * in. Trip-scoped listing + cross-trip aggregation are different
 * concerns; mixing them on one controller would force the auth
 * model to be the LCD of "trip-collab gate vs. @Public()".
 *
 *   GET /api/v1/votes/summary?targetType=&targetId=
 *
 * Auth: `@Public()` — vote counts are crowd signal, no PII.
 * Same precedent as `/reviews/summary` ([IV.18.12.8]).
 *
 * Installed by prompt [IV.18.12.9].
 */
import { BadRequestException, Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { VoteSummaryDto as VoteSummaryResponseDto } from './dto/social-response.dto';
import { Public } from '../../../common/auth';
import { GetVoteSummaryUseCase } from '../application/get-vote-summary.use-case';
import type { VoteSummary } from '../application/ports/vote.repository';
import type { VoteTargetType } from '../domain/vote.entity';
import { VoteSummaryTargetTypeSchema } from './dto/social.dto';

interface VoteSummaryDto {
  readonly targetType: string;
  readonly targetId: string;
  readonly up: number;
  readonly meh: number;
  readonly down: number;
  readonly score: number;
}

function toDto(s: VoteSummary): VoteSummaryDto {
  return {
    targetType: s.targetType,
    targetId: s.targetId,
    up: s.up,
    meh: s.meh,
    down: s.down,
    score: s.score,
  };
}

@ApiTags('social')
@Controller('votes')
export class VotesController {
  constructor(private readonly summaryUc: GetVoteSummaryUseCase) {}

  @ApiOperation({
    summary:
      'Cross-trip vote tally for { targetType, targetId }. @Public — crowd-signal aggregation.',
  })
  @ApiResponse({
    status: 200,
    description: 'Vote tally; zero-filled for empty targets.',
    type: VoteSummaryResponseDto,
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
  ): Promise<VoteSummaryDto> {
    if (!targetType || !targetId) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'targetType and targetId query params are required',
      });
    }
    const parsed = VoteSummaryTargetTypeSchema.safeParse(targetType);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'targetType must be one of: itinerary_item | place | restaurant',
      });
    }
    const result = await this.summaryUc.execute({
      targetType: parsed.data as VoteTargetType,
      targetId,
    });
    return toDto(result);
  }
}
