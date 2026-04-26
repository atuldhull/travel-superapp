/**
 * Eatery detail-page composite read endpoint.
 *
 *   GET /api/v1/eateries/:id/review-summary
 *
 * Thin wrapper over `GetReviewBundleForTargetUseCase` with
 * `targetType: 'eatery'`. Same shape as the place + stay
 * variants. Eateries don't track votes today (votes table only
 * allows place / restaurant / itinerary_item per
 * `[IV.18.12.9]`), so the `votes` block returns all zeros —
 * the use-case maps eatery → no vote target and zero-fills.
 *
 * `@Public()` — same precedent as the underlying summary
 * endpoints.
 *
 * Lives in SocialModule (NOT FoodModule) — same
 * URL-vs-module-boundary decoupling rule from `[IV.18.12.11]`.
 * Route mounts at `/eateries/:id/review-summary` regardless
 * of owning module.
 *
 * Installed by prompt [IV.18.7.7].
 */
import { Controller, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/auth';
import { GetReviewBundleForTargetUseCase } from '../application/get-review-bundle-for-target.use-case';
import { reviewBundleToDto, type ReviewBundleResponseDto } from './dto/review-bundle.dto';
import { EateryReviewSummaryResponseDto } from './dto/social-response.dto';

interface EateryReviewSummaryDto extends ReviewBundleResponseDto {
  readonly eateryId: string;
}

@ApiTags('social')
@Controller('eateries')
export class EateryReviewSummaryController {
  constructor(private readonly bundleUc: GetReviewBundleForTargetUseCase) {}

  @ApiOperation({
    summary: 'Eatery detail-page composite. Same shape as place; votes always zero.',
  })
  @ApiResponse({
    status: 200,
    description: 'Eatery review bundle.',
    type: EateryReviewSummaryResponseDto,
  })
  @Get(':id/review-summary')
  @Public()
  @HttpCode(HttpStatus.OK)
  async summary(@Param('id') id: string): Promise<EateryReviewSummaryDto> {
    const result = await this.bundleUc.execute('eatery', id);
    return { eateryId: id, ...reviewBundleToDto(result) };
  }
}
