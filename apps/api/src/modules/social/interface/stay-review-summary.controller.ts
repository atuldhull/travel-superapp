/**
 * Stay detail-page composite read endpoint.
 *
 *   GET /api/v1/stays/:id/review-summary
 *
 * Thin wrapper over `GetReviewBundleForTargetUseCase` with
 * `targetType: 'stay'`. Same shape as the place variant. Stays
 * don't track votes today (votes table only allows place /
 * restaurant / itinerary_item per `[IV.18.12.9]`), so the
 * `votes` block returns all zeros — the use-case does the
 * mapping internally.
 *
 * `@Public()` — same precedent as the underlying summary
 * endpoints.
 *
 * Lives in SocialModule (NOT StaysModule) — same
 * URL-vs-module-boundary decoupling rule from `[IV.18.12.11]`.
 * Route mounts at `/stays/:id/review-summary` regardless of
 * owning module.
 *
 * Installed by prompt [IV.18.6.5].
 */
import { Controller, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/auth';
import { GetReviewBundleForTargetUseCase } from '../application/get-review-bundle-for-target.use-case';
import { reviewBundleToDto, type ReviewBundleResponseDto } from './dto/review-bundle.dto';
import { StayReviewSummaryResponseDto } from './dto/social-response.dto';

interface StayReviewSummaryDto extends ReviewBundleResponseDto {
  readonly stayId: string;
}

@ApiTags('social')
@Controller('stays')
export class StayReviewSummaryController {
  constructor(private readonly bundleUc: GetReviewBundleForTargetUseCase) {}

  @ApiOperation({
    summary:
      'Stay detail-page composite. Same shape as place; votes always zero (no vote target for stays).',
  })
  @ApiResponse({
    status: 200,
    description: 'Stay review bundle.',
    type: StayReviewSummaryResponseDto,
  })
  @Get(':id/review-summary')
  @Public()
  @HttpCode(HttpStatus.OK)
  async summary(@Param('id') id: string): Promise<StayReviewSummaryDto> {
    const result = await this.bundleUc.execute('stay', id);
    return { stayId: id, ...reviewBundleToDto(result) };
  }
}
