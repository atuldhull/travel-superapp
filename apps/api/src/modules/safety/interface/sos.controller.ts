/**
 * SOS HTTP surface.
 *
 *   POST   /api/v1/safety/sos                  — trigger
 *   GET    /api/v1/safety/sos                  — list mine (most recent first)
 *   POST   /api/v1/safety/sos/:id/resolve      — mark resolved (owner-only)
 *
 * Kept in a separate controller from `SafetyController` (scam
 * reports) for clarity — two different primitives with different
 * auth/IDOR stories. Both live in the Safety module.
 *
 * Installed by prompt [IV.18.11.2].
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { type AuthenticatedUser, CurrentUser } from '../../../common/auth';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { ListMySosEventsUseCase } from '../application/list-my-sos-events.use-case';
import { ResolveSosUseCase } from '../application/resolve-sos.use-case';
import { TriggerSosUseCase } from '../application/trigger-sos.use-case';
import type { SosEvent } from '../domain/sos-event.entity';
import {
  ResolveSosBodySchema,
  TriggerSosBodySchema,
  type ResolveSosBody,
  type TriggerSosBody,
} from './dto/safety.dto';
import {
  ListSosEventsResponseDto,
  ResolveSosRequestDto,
  SosEventDto as SosEventResponseDto,
  TriggerSosRequestDto,
} from './dto/safety-subs-response.dto';

interface SosEventDto {
  readonly id: string;
  readonly userId: string;
  readonly trigger: string;
  readonly resolvedAt: string | null;
  readonly resolutionNote: string | null;
  readonly createdAt: string;
}

function toDto(e: SosEvent): SosEventDto {
  return {
    id: e.id,
    userId: e.userId,
    trigger: e.trigger,
    resolvedAt: e.resolvedAt ? e.resolvedAt.toISOString() : null,
    resolutionNote: e.resolutionNote,
    createdAt: e.createdAt.toISOString(),
  };
}

@ApiTags('safety')
@ApiBearerAuth()
@Controller('safety/sos')
export class SosController {
  constructor(
    private readonly triggerUc: TriggerSosUseCase,
    private readonly listUc: ListMySosEventsUseCase,
    private readonly resolveUc: ResolveSosUseCase,
  ) {}

  @ApiOperation({ summary: 'Trigger an SOS event at the given coordinates.' })
  @ApiBody({ type: TriggerSosRequestDto })
  @ApiResponse({ status: 201, description: 'New SOS event row.', type: SosEventResponseDto })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async trigger(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(TriggerSosBodySchema)) body: TriggerSosBody,
  ): Promise<SosEventDto> {
    const sos = await this.triggerUc.execute({
      userId: user.sub,
      trigger: body.trigger,
      lat: body.center.lat,
      lng: body.center.lng,
    });
    return toDto(sos);
  }

  @ApiOperation({
    summary: "List the caller's SOS events, most-recent-first. ?limit (1..200, default 50).",
  })
  @ApiResponse({ status: 200, description: "Caller's events.", type: ListSosEventsResponseDto })
  @Get()
  @HttpCode(HttpStatus.OK)
  async listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ): Promise<{ events: SosEventDto[] }> {
    const parsed = limit ? Math.max(1, Math.min(200, Number(limit) || 50)) : 50;
    const events = await this.listUc.execute(user.sub, parsed);
    return { events: events.map(toDto) };
  }

  @ApiOperation({ summary: 'Mark an SOS event resolved (owner-only).' })
  @ApiBody({ type: ResolveSosRequestDto })
  @ApiResponse({ status: 200, description: 'Resolved event row.', type: SosEventResponseDto })
  @ApiResponse({ status: 404, description: 'SOS_NOT_FOUND.' })
  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  async resolve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ResolveSosBodySchema)) body: ResolveSosBody,
  ): Promise<SosEventDto> {
    const sos = await this.resolveUc.execute({
      id,
      userId: user.sub,
      ...(body.note !== undefined ? { note: body.note } : {}),
    });
    return toDto(sos);
  }
}
