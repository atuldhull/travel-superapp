/**
 * V.UX.24 — caller-self agent surfaces (profile + dashboard).
 * Sibling to the existing `AgentsController` (which handles the
 * marketplace match for trip owners) — kept separate so the
 * `@Roles('agent','admin')` gate stays scoped to caller-self routes
 * only.
 *
 *   GET   /api/v1/agent/me                       — own profile
 *   PATCH /api/v1/agent/me                       — partial update
 *   GET   /api/v1/agent/me/dashboard?windowDays= — composite
 *
 * Non-agent roles are rejected by `RolesGuard` with `ROLE_FORBIDDEN`.
 *
 * Installed by prompt [V.UX.24].
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { type AuthenticatedUser, CurrentUser, Roles } from '../../../common/auth';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { GetAgentDashboardUseCase } from '../application/get-agent-dashboard.use-case';
import { GetAgentProfileUseCase } from '../application/get-agent-profile.use-case';
import { UpdateAgentProfileUseCase } from '../application/update-agent-profile.use-case';
import type {
  AgentBookingSummary,
  AgentEarningsSummary,
  AgentProfile,
  AgentReviewWithResponse,
} from '../domain/agent-profile.entity';
import {
  AgentDashboardDto,
  AgentProfileDto,
  DashboardQuerySchema,
  UpdateAgentProfileBodySchema,
  UpdateAgentProfileRequestDto,
  type DashboardQuery,
  type UpdateAgentProfileBody,
} from './dto/agent-self.dto';

function toProfileDto(p: AgentProfile): AgentProfileDto {
  return {
    id: p.id,
    userId: p.userId,
    displayName: p.displayName,
    bio: p.bio,
    kycStatus: p.kycStatus,
    verifiedAt: p.verifiedAt === null ? null : p.verifiedAt.toISOString(),
    languages: [...p.languages],
    regions: [...p.regions],
    ratingAverage: p.ratingAverage,
    ratingCount: p.ratingCount,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  } satisfies AgentProfileDto;
}

function toBookingDto(b: AgentBookingSummary): AgentDashboardDto['bookings'][number] {
  return {
    id: b.id,
    userId: b.userId,
    amountUsd: b.amountUsd,
    currency: b.currency,
    state: b.state,
    heldAt: b.heldAt.toISOString(),
    releasedAt: b.releasedAt === null ? null : b.releasedAt.toISOString(),
    refundedAt: b.refundedAt === null ? null : b.refundedAt.toISOString(),
  };
}

function toReviewDto(r: AgentReviewWithResponse): AgentDashboardDto['reviews'][number] {
  return {
    id: r.id,
    authorId: r.authorId,
    rating: r.rating,
    body: r.body,
    language: r.language,
    verifiedBooking: r.verifiedBooking,
    responseBody: r.responseBody,
    responseAt: r.responseAt === null ? null : r.responseAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  };
}

function toEarningsDto(e: AgentEarningsSummary): AgentDashboardDto['earnings'] {
  return { grossUsd: e.grossUsd, bookingsCount: e.bookingsCount };
}

@ApiTags('agents')
@ApiBearerAuth()
@Roles('agent', 'admin')
@Controller('agent/me')
export class AgentSelfController {
  constructor(
    private readonly getProfile: GetAgentProfileUseCase,
    private readonly updateProfile: UpdateAgentProfileUseCase,
    private readonly getDashboard: GetAgentDashboardUseCase,
  ) {}

  @ApiOperation({ summary: "The caller's Agent profile (agent/admin role only)." })
  @ApiResponse({ status: 200, description: 'Agent profile.', type: AgentProfileDto })
  @ApiResponse({ status: 404, description: 'AGENT_PROFILE_NOT_FOUND.' })
  @Get()
  @HttpCode(HttpStatus.OK)
  async me(@CurrentUser() user: AuthenticatedUser): Promise<AgentProfileDto> {
    const p = await this.getProfile.execute(user.sub);
    return toProfileDto(p);
  }

  @ApiOperation({ summary: 'Partial update of the caller-owned Agent profile.' })
  @ApiBody({ type: UpdateAgentProfileRequestDto })
  @ApiResponse({ status: 200, description: 'Updated profile.', type: AgentProfileDto })
  @ApiResponse({
    status: 422,
    description: 'INVALID_AGENT_DISPLAY_NAME | INVALID_AGENT_BIO | INVALID_AGENT_LIST.',
  })
  @ApiResponse({ status: 404, description: 'AGENT_PROFILE_NOT_FOUND.' })
  @Patch()
  @HttpCode(HttpStatus.OK)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(UpdateAgentProfileBodySchema)) body: UpdateAgentProfileBody,
  ): Promise<AgentProfileDto> {
    const cmd: {
      userId: string;
      displayName?: string;
      bio?: string | null;
      languages?: readonly string[];
      regions?: readonly string[];
    } = { userId: user.sub };
    if (body.displayName !== undefined) cmd.displayName = body.displayName;
    if (body.bio !== undefined) cmd.bio = body.bio;
    if (body.languages !== undefined) cmd.languages = body.languages;
    if (body.regions !== undefined) cmd.regions = body.regions;
    const updated = await this.updateProfile.execute(cmd);
    return toProfileDto(updated);
  }

  @ApiOperation({
    summary:
      'Composite dashboard: profile + bookings + earnings + recent reviews. Window default 30 days.',
  })
  @ApiQuery({ name: 'windowDays', required: false, type: Number, minimum: 1, maximum: 365 })
  @ApiResponse({ status: 200, description: 'Agent dashboard.', type: AgentDashboardDto })
  @ApiResponse({ status: 404, description: 'AGENT_PROFILE_NOT_FOUND.' })
  @Get('dashboard')
  @HttpCode(HttpStatus.OK)
  async dashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(DashboardQuerySchema)) query: DashboardQuery,
  ): Promise<AgentDashboardDto> {
    const dash = await this.getDashboard.execute({
      userId: user.sub,
      ...(query.windowDays !== undefined ? { windowDays: query.windowDays } : {}),
    });
    return {
      profile: toProfileDto(dash.profile),
      bookings: dash.bookings.map(toBookingDto),
      earnings: toEarningsDto(dash.earnings),
      reviews: dash.reviews.map(toReviewDto),
      windowDays: dash.windowDays,
    } satisfies AgentDashboardDto;
  }
}
