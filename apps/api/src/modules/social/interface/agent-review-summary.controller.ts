/**
 * Agent detail-page composite read endpoint.
 *
 *   GET /api/v1/agents/:id/review-summary
 *
 * Thin wrapper over `GetReviewBundleForTargetUseCase` with
 * `targetType: 'agent'`. Same shape as the place + stay +
 * eatery variants. Agents don't track votes today (votes table
 * only allows place / restaurant / itinerary_item per
 * `[IV.18.12.9]`), so the `votes` block returns all zeros —
 * the use-case maps agent → no vote target and zero-fills.
 *
 * `@Public()` — same precedent as the underlying summary
 * endpoints. Closes the review-bundle composite arc for v1
 * (4-of-4 review-target types covered: place, stay, eatery,
 * agent).
 *
 * Lives in SocialModule (NOT SafetyModule, where Agent lives) —
 * same URL-vs-module-boundary decoupling rule from
 * `[IV.18.12.11]`. Route mounts at `/agents/:id/review-summary`
 * regardless of owning module.
 *
 * Installed by prompt [IV.18.12.12].
 */
import { Controller, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/auth';
import { GetReviewBundleForTargetUseCase } from '../application/get-review-bundle-for-target.use-case';
import { reviewBundleToDto, type ReviewBundleResponseDto } from './dto/review-bundle.dto';
import { AgentReviewSummaryResponseDto } from './dto/social-response.dto';

interface AgentReviewSummaryDto extends ReviewBundleResponseDto {
  readonly agentId: string;
}

@ApiTags('social')
@Controller('agents')
export class AgentReviewSummaryController {
  constructor(private readonly bundleUc: GetReviewBundleForTargetUseCase) {}

  @ApiOperation({
    summary: 'Agent detail-page composite. Closes the 4-of-4 review-target arc; votes always zero.',
  })
  @ApiResponse({
    status: 200,
    description: 'Agent review bundle.',
    type: AgentReviewSummaryResponseDto,
  })
  @Get(':id/review-summary')
  @Public()
  @HttpCode(HttpStatus.OK)
  async summary(@Param('id') id: string): Promise<AgentReviewSummaryDto> {
    const result = await this.bundleUc.execute('agent', id);
    return { agentId: id, ...reviewBundleToDto(result) };
  }
}
