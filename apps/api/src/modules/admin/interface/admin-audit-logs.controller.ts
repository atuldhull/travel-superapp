/**
 * V.UX.36 — read-only admin audit log surface.
 *
 *   GET /api/v1/admin/audit-logs?actorId=&targetType=&targetId=&action=&limit=&offset=
 *     200 → { rows: AdminAuditLogDto[], total }
 *
 * Class-level `@Roles('admin')` gates the route.
 *
 * Append-only: there is NO POST/PATCH/DELETE here by design — the
 * audit trail is meant to be tamper-resistant from inside the app.
 */
import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/auth';
import {
  AdminListAuditLogsUseCase,
  type AdminListAuditLogsQuery,
} from '../application/admin-list-audit-logs.use-case';
import type { AdminAuditLog } from '../domain/admin-audit-log.entity';

class AdminAuditLogDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({
    format: 'cuid',
    nullable: true,
    description:
      'User id of the admin who performed the action. Null if that admin was later deleted.',
  })
  declare actorId: string | null;

  @ApiProperty({ description: 'user | scam_report | sos | media | trip' })
  declare targetType: string;

  @ApiProperty()
  declare targetId: string;

  @ApiProperty({
    description: 'ban | unban | verify_scam | dismiss_scam | resolve_sos | delete_media | ...',
  })
  declare action: string;

  @ApiProperty({
    nullable: true,
    description: 'Per-action JSON payload (e.g. {reason} for ban, {note} for resolve_sos).',
    type: 'object',
    additionalProperties: true,
  })
  declare context: Record<string, unknown> | null;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;
}

class AdminListAuditLogsResponseDto {
  @ApiProperty({ type: [AdminAuditLogDto] })
  declare rows: AdminAuditLogDto[];

  @ApiProperty()
  declare total: number;
}

interface AdminAuditLogJson {
  readonly id: string;
  readonly actorId: string | null;
  readonly targetType: string;
  readonly targetId: string;
  readonly action: string;
  readonly context: Record<string, unknown> | null;
  readonly createdAt: string;
}

function toDto(r: AdminAuditLog): AdminAuditLogJson {
  return {
    id: r.id,
    actorId: r.actorId,
    targetType: r.targetType,
    targetId: r.targetId,
    action: r.action,
    context: r.context,
    createdAt: r.createdAt.toISOString(),
  };
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/audit-logs')
@Roles('admin')
export class AdminAuditLogsController {
  constructor(private readonly listUc: AdminListAuditLogsUseCase) {}

  @ApiOperation({
    summary:
      'V.UX.36 — read-only admin audit log. Filter by actorId / targetType / targetId / action. Newest first.',
  })
  @ApiResponse({
    status: 200,
    description: 'Matching audit rows + total.',
    type: AdminListAuditLogsResponseDto,
  })
  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @Query('actorId') actorId?: string,
    @Query('targetType') targetType?: string,
    @Query('targetId') targetId?: string,
    @Query('action') action?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ rows: AdminAuditLogJson[]; total: number }> {
    const query: AdminListAuditLogsQuery = {
      ...(actorId && actorId.trim().length > 0 ? { actorId: actorId.trim() } : {}),
      ...(targetType && targetType.trim().length > 0 ? { targetType: targetType.trim() } : {}),
      ...(targetId && targetId.trim().length > 0 ? { targetId: targetId.trim() } : {}),
      ...(action && action.trim().length > 0 ? { action: action.trim() } : {}),
      ...(limit ? { limit: Math.max(1, Math.min(200, Number(limit) || 50)) } : {}),
      ...(offset ? { offset: Math.max(0, Number(offset) || 0) } : {}),
    };
    const result = await this.listUc.execute(query);
    return { rows: result.rows.map(toDto), total: result.total };
  }
}
