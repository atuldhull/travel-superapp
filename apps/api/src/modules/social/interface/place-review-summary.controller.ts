/**
 * Place detail-page composite read endpoint.
 *
 *   GET /api/v1/places/:id/review-summary
 *
 * Thin wrapper over `GetReviewBundleForTargetUseCase` with
 * `targetType: 'place'`. Same shape served by the stay variant
 * at `/stays/:id/review-summary` (`[IV.18.6.5]`).
 *
 * `@Public()` — review + vote summaries are crowd signal, no
 * PII. Empty target → 200 with all-zero shape (NOT 404).
 *
 * Lives in SocialModule (NOT PlacesModule) — see
 * `[IV.18.12.11]` for the URL-vs-module-boundary decoupling
 * rule. The route is mounted at `/places/:id/review-summary`
 * regardless of the owning module.
 *
 * Installed by prompt [IV.18.12.11]; switched to the
 * generalized use-case in [IV.18.6.5].
 */
import { Controller, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/auth';
import { GetReviewBundleForTargetUseCase } from '../application/get-review-bundle-for-target.use-case';
import { reviewBundleToDto, type ReviewBundleResponseDto } from './dto/review-bundle.dto';
import { PlaceReviewSummaryResponseDto } from './dto/social-response.dto';

interface PlaceReviewSummaryDto extends ReviewBundleResponseDto {
  readonly placeId: string;
}

@ApiTags('social')
@Controller('places')
export class PlaceReviewSummaryController {
  constructor(private readonly bundleUc: GetReviewBundleForTargetUseCase) {}

  @ApiOperation({
    summary:
      'Place detail-page composite — bundles review summary + vote tally + recent reviews. @Public.',
  })
  @ApiResponse({
    status: 200,
    description: 'Place review bundle.',
    type: PlaceReviewSummaryResponseDto,
  })
  @Get(':id/review-summary')
  @Public()
  @HttpCode(HttpStatus.OK)
  async summary(@Param('id') id: string): Promise<PlaceReviewSummaryDto> {
    const result = await this.bundleUc.execute('place', id);
    return { placeId: id, ...reviewBundleToDto(result) };
  }
}
