/**
 * Admin SOS triage HTTP surface.
 *
 *   GET  /api/v1/admin/safety/sos-events?status=&limit=&offset=
 *   POST /api/v1/admin/safety/sos-events/:id/resolve
 *
 * Class-level `@Roles('admin')` gates every method. Lives in
 * Safety module (admin-in-owning-module pattern, same as scam
 * moderation).
 *
 * Default `status` is unset (returns both active + resolved) so
 * the operator sees the full picture. The frontend triage view
 * adds `?status=active` for the actionable queue.
 *
 * Installed by prompt [IV.18.18.2].
 */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../../../common/auth';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { AdminListSosEventsUseCase } from '../application/admin-list-sos-events.use-case';
import { AdminResolveSosUseCase } from '../application/admin-resolve-sos.use-case';
import type { AdminSosListStatus } from '../application/ports/sos-event.repository';
import type { SosEvent } from '../domain/sos-event.entity';

const VALID_STATUSES: readonly AdminSosListStatus[] = ['active', 'resolved'];

const AdminResolveSosBodySchema = z.object({
  note: z.string().trim().max(500).nullable().optional(),
});
type AdminResolveSosBody = z.infer<typeof AdminResolveSosBodySchema>;

interface SosEventDto {
  readonly id: string;
  readonly userId: string;
  readonly trigger: string;
  readonly resolvedAt: string | null;
  readonly resolutionNote: string | null;
  readonly createdAt: string;
}

function toDto(s: SosEvent): SosEventDto {
  return {
    id: s.id,
    userId: s.userId,
    trigger: s.trigger,
    resolvedAt: s.resolvedAt ? s.resolvedAt.toISOString() : null,
    resolutionNote: s.resolutionNote,
    createdAt: s.createdAt.toISOString(),
  };
}

@Controller('admin/safety/sos-events')
@Roles('admin')
export class AdminSosController {
  constructor(
    private readonly listUc: AdminListSosEventsUseCase,
    private readonly resolveUc: AdminResolveSosUseCase,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ events: SosEventDto[]; total: number }> {
    let parsedStatus: AdminSosListStatus | undefined;
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status as AdminSosListStatus)) {
        throw new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: `status must be one of: ${VALID_STATUSES.join(' | ')}`,
        });
      }
      parsedStatus = status as AdminSosListStatus;
    }
    const parsedLimit = limit ? Math.max(1, Math.min(200, Number(limit) || 50)) : undefined;
    const parsedOffset = offset ? Math.max(0, Number(offset) || 0) : undefined;
    const result = await this.listUc.execute({
      ...(parsedStatus !== undefined ? { status: parsedStatus } : {}),
      ...(parsedLimit !== undefined ? { limit: parsedLimit } : {}),
      ...(parsedOffset !== undefined ? { offset: parsedOffset } : {}),
    });
    return { events: result.rows.map(toDto), total: result.total };
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  async resolve(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AdminResolveSosBodySchema)) body: AdminResolveSosBody,
  ): Promise<SosEventDto> {
    const row = await this.resolveUc.execute({
      id,
      ...(body.note !== undefined && body.note !== null ? { note: body.note } : {}),
    });
    return toDto(row);
  }
}
