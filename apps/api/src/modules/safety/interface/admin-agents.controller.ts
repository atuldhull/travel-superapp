/**
 * [S-E5] Admin agent-KYC moderation surface.
 *
 *   GET    /api/v1/admin/agents                     — list pending (default)
 *          ?status=verified | rejected               — other piles
 *          ?limit=N&offset=N                         — pagination (limit ≤ 200)
 *   POST   /api/v1/admin/agents/:id/verify           — verify (sets verifiedAt = now)
 *   POST   /api/v1/admin/agents/:id/reject           — reject (clears verifiedAt) + reason
 *
 * Class-level `@Roles('admin')` gates every method. Every mutation
 * writes an AdminAuditLog row; the Slack notifier ([S-E6]) pings on
 * verify_agent + reject_agent (added to the PING_ACTIONS set in the
 * same slice as this controller).
 *
 * Installed by [S-E5] of the S-series real-functionality closeout.
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, Roles, type AuthenticatedUser } from '../../../common/auth';
import { AdminListPendingAgentsUseCase } from '../application/admin-list-pending-agents.use-case';
import { AdminRejectAgentUseCase } from '../application/admin-reject-agent.use-case';
import { AdminVerifyAgentUseCase } from '../application/admin-verify-agent.use-case';
import type { AgentProfile } from '../domain/agent-profile.entity';

class AdminAgentDto {
  @ApiProperty({ example: 'clx1234567890abcdef' })
  declare id: string;
  @ApiProperty({ example: 'clxuserabcdef' })
  declare userId: string;
  @ApiProperty({ example: 'Asha Patel' })
  declare displayName: string;
  @ApiProperty({ example: 'Specialised in Himalayan high-altitude treks.', nullable: true })
  declare bio: string | null;
  @ApiProperty({ enum: ['pending', 'verified', 'rejected'], example: 'pending' })
  declare kycStatus: string;
  @ApiProperty({ example: '2026-04-10T12:00:00.000Z', nullable: true })
  declare verifiedAt: string | null;
  @ApiProperty({ example: ['en', 'hi'], type: [String] })
  declare languages: readonly string[];
  @ApiProperty({ example: ['himalayas', 'south-asia'], type: [String] })
  declare regions: readonly string[];
  @ApiProperty({ example: 4.6 })
  declare ratingAverage: number;
  @ApiProperty({ example: 23 })
  declare ratingCount: number;
  @ApiProperty({ example: '2026-03-01T00:00:00.000Z' })
  declare createdAt: string;
  @ApiProperty({ example: '2026-05-12T00:00:00.000Z' })
  declare updatedAt: string;
}

class AdminListAgentsResponseDto {
  @ApiProperty({ type: [AdminAgentDto] })
  declare agents: AdminAgentDto[];
  @ApiProperty({ example: 12 })
  declare total: number;
}

class AdminRejectAgentRequestDto {
  @ApiProperty({
    example: 'KYC docs failed verification; passport copy unreadable.',
    minLength: 1,
    maxLength: 280,
  })
  declare reason: string;
}

function toDto(a: AgentProfile): AdminAgentDto {
  return {
    id: a.id,
    userId: a.userId,
    displayName: a.displayName,
    bio: a.bio,
    kycStatus: a.kycStatus,
    verifiedAt: a.verifiedAt ? a.verifiedAt.toISOString() : null,
    languages: a.languages,
    regions: a.regions,
    ratingAverage: a.ratingAverage,
    ratingCount: a.ratingCount,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/agents')
@Roles('admin')
export class AdminAgentsController {
  constructor(
    private readonly listUc: AdminListPendingAgentsUseCase,
    private readonly verifyUc: AdminVerifyAgentUseCase,
    private readonly rejectUc: AdminRejectAgentUseCase,
  ) {}

  @ApiOperation({
    summary: 'List agents by KYC status. Default = pending; ?status= for verified / rejected.',
  })
  @ApiResponse({ status: 200, type: AdminListAgentsResponseDto })
  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<AdminListAgentsResponseDto> {
    const parsedStatus =
      status === 'verified' || status === 'rejected' || status === 'pending' ? status : 'pending';
    const parsedLimit = limit ? Math.max(1, Math.min(200, Number(limit) || 50)) : 50;
    const parsedOffset = offset ? Math.max(0, Number(offset) || 0) : 0;
    const result = await this.listUc.execute({
      status: parsedStatus,
      limit: parsedLimit,
      offset: parsedOffset,
    });
    return { agents: result.agents.map(toDto), total: result.total };
  }

  @ApiOperation({ summary: 'Verify an agent KYC (sets verifiedAt = now).' })
  @ApiResponse({ status: 200, type: AdminAgentDto })
  @ApiResponse({ status: 404, description: 'AGENT_NOT_FOUND.' })
  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  async verify(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<AdminAgentDto> {
    const updated = await this.verifyUc.execute({ actorId: admin.sub, agentId: id });
    return toDto(updated);
  }

  @ApiOperation({ summary: 'Reject an agent KYC (clears verifiedAt) with a reason.' })
  @ApiBody({ type: AdminRejectAgentRequestDto })
  @ApiResponse({ status: 200, type: AdminAgentDto })
  @ApiResponse({ status: 400, description: 'INVALID_REJECTION_REASON.' })
  @ApiResponse({ status: 404, description: 'AGENT_NOT_FOUND.' })
  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: AdminRejectAgentRequestDto,
  ): Promise<AdminAgentDto> {
    const updated = await this.rejectUc.execute({
      actorId: admin.sub,
      agentId: id,
      reason: body.reason,
    });
    return toDto(updated);
  }
}
