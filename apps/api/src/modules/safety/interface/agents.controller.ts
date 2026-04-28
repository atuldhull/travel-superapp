/**
 * V.UX.17 — concierge HTTP surface. Premium-tier (or admin) callers
 * only — `@Roles('premium', 'admin')` is the enforcement seam.
 *
 *   POST /api/v1/agents/match-for-trip
 *     body: { tripId, region? }
 *     200  → { matches: AgentMatchDto[] }
 *     403  → ROLE_FORBIDDEN
 *     404  → TRIP_NOT_FOUND
 *
 * Installed by prompt [V.UX.17].
 */
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { type AuthenticatedUser, CurrentUser, Roles } from '../../../common/auth';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { MatchAgentForTripUseCase } from '../application/match-agent-for-trip.use-case';
import type { AgentMatch } from '../domain/agent-match.entity';
import {
  MatchAgentForTripBodySchema,
  MatchAgentForTripRequestDto,
  MatchAgentForTripResponseDto,
  type MatchAgentForTripBody,
} from './dto/agent.dto';

interface AgentMatchDto {
  readonly id: string;
  readonly displayName: string;
  readonly bio: string | null;
  readonly languages: readonly string[];
  readonly regions: readonly string[];
  readonly ratingAverage: number;
  readonly ratingCount: number;
  readonly verifiedAt: string;
}

function toDto(a: AgentMatch): AgentMatchDto {
  return {
    id: a.id,
    displayName: a.displayName,
    bio: a.bio,
    languages: a.languages,
    regions: a.regions,
    ratingAverage: Math.round(a.ratingAverage * 10) / 10,
    ratingCount: a.ratingCount,
    verifiedAt: a.verifiedAt.toISOString(),
  };
}

@ApiTags('agents')
@ApiBearerAuth()
@Controller('agents')
export class AgentsController {
  constructor(private readonly matchUc: MatchAgentForTripUseCase) {}

  @ApiOperation({
    summary:
      'Premium-only concierge match: top 3 verified agents for the caller-owned trip, optionally region-filtered.',
  })
  @ApiBody({ type: MatchAgentForTripRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Top 3 matches, oldest possible empty array.',
    type: MatchAgentForTripResponseDto,
  })
  @ApiResponse({ status: 403, description: 'ROLE_FORBIDDEN.' })
  @ApiResponse({ status: 404, description: 'TRIP_NOT_FOUND.' })
  @Roles('premium', 'admin')
  @Post('match-for-trip')
  @HttpCode(HttpStatus.OK)
  async matchForTrip(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(MatchAgentForTripBodySchema)) body: MatchAgentForTripBody,
  ): Promise<{ matches: AgentMatchDto[] }> {
    const matches = await this.matchUc.execute({
      tripId: body.tripId,
      ownerId: user.sub,
      ...(body.region !== undefined ? { region: body.region } : {}),
    });
    return { matches: matches.map(toDto) };
  }
}
