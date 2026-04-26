/**
 * Social (voting) HTTP surface. Nested under `/trips/:tripId/*`
 * because votes are always trip-scoped — the trip is the unit of
 * collaboration + the auth gate (owner OR trip has active share).
 *
 *   POST   /api/v1/trips/:tripId/votes        body: { targetType, targetId, value }
 *   DELETE /api/v1/trips/:tripId/votes        body: { targetType, targetId }
 *   GET    /api/v1/trips/:tripId/votes        → aggregated tallies + caller's own vote
 *
 * v1 only accepts `targetType: 'itinerary_item'`. Places +
 * restaurants become vote-able in follow-up slices; the schema
 * enum + the domain type are ready.
 *
 * DELETE uses a body (not a query string) because the composite
 * key is (targetType + targetId) and two query params read uglier
 * than one JSON object. HTTP DELETE-with-body is explicitly
 * allowed by RFC 9110 §9.3.5 even though some toolchains
 * historically discouraged it — Fastify handles it cleanly.
 *
 * Installed by prompt [IV.18.12.3].
 */
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthenticatedUser, CurrentUser } from '../../../common/auth';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CastVoteUseCase } from '../application/cast-vote.use-case';
import { ListTripVotesUseCase } from '../application/list-trip-votes.use-case';
import { RevokeVoteUseCase } from '../application/revoke-vote.use-case';
import type { Vote, VoteTally } from '../domain/vote.entity';
import {
  CastVoteBodySchema,
  RevokeVoteBodySchema,
  type CastVoteBody,
  type RevokeVoteBody,
} from './dto/social.dto';

interface VoteDto {
  readonly id: string;
  readonly tripId: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly value: number;
  readonly createdAt: string;
}

function toDto(v: Vote): VoteDto {
  return {
    id: v.id,
    tripId: v.tripId,
    targetType: v.targetType,
    targetId: v.targetId,
    value: v.value,
    createdAt: v.createdAt.toISOString(),
  };
}

@ApiTags('social')
@ApiBearerAuth()
@Controller('trips/:tripId/votes')
export class SocialController {
  constructor(
    private readonly castUc: CastVoteUseCase,
    private readonly revokeUc: RevokeVoteUseCase,
    private readonly listUc: ListTripVotesUseCase,
  ) {}

  @ApiOperation({
    summary:
      'Cast or update a vote on a trip target. Body: { targetType, targetId, value }. Auth gate: owner OR active TripShare.',
  })
  @Post()
  @HttpCode(HttpStatus.OK)
  async cast(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId') tripId: string,
    @Body(new ZodValidationPipe(CastVoteBodySchema)) body: CastVoteBody,
  ): Promise<VoteDto> {
    const vote = await this.castUc.execute({
      tripId,
      userId: user.sub,
      targetType: body.targetType,
      targetId: body.targetId,
      value: body.value,
    });
    return toDto(vote);
  }

  @ApiOperation({
    summary: 'Revoke a previously-cast vote. Body: { targetType, targetId }. Idempotent.',
  })
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId') tripId: string,
    @Body(new ZodValidationPipe(RevokeVoteBodySchema)) body: RevokeVoteBody,
  ): Promise<void> {
    await this.revokeUc.execute({
      tripId,
      userId: user.sub,
      targetType: body.targetType,
      targetId: body.targetId,
    });
  }

  @ApiOperation({
    summary: "Aggregated tallies for a trip's votes + the caller's own vote per target.",
  })
  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId') tripId: string,
  ): Promise<{ tallies: readonly VoteTally[] }> {
    const tallies = await this.listUc.execute({ tripId, userId: user.sub });
    return { tallies };
  }
}
