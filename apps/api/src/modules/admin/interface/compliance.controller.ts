/**
 * V.UX.37 — compliance dashboard HTTP surface.
 *
 *   GET /api/v1/compliance/retention
 *     200 → RetentionStatsResponseDto (16 indexed counts + oldest
 *           soft-delete + days-until-purge)
 *
 *   GET /api/v1/compliance/takedowns?limit=&offset=
 *     200 → TakedownListResponseDto (paginated audit rows for
 *           delete_media/delete_trip/archive_trip/dismiss_scam)
 *
 * Class-level `@Roles('compliance', 'admin')` — admins also see
 * compliance surfaces (admin is strictly stronger). Non-compliance,
 * non-admin callers get 403 ROLE_FORBIDDEN; anon → 401.
 *
 * Read-only by design. There is no POST/PATCH/DELETE here.
 */
import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/auth';
import { GetRetentionStatsUseCase } from '../application/get-retention-stats.use-case';
import { ListTakedownsUseCase } from '../application/list-takedowns.use-case';
import type { AdminAuditLog } from '../domain/admin-audit-log.entity';

class RetentionUsersDto {
  @ApiProperty() declare active: number;
  @ApiProperty() declare softDeleted: number;
  @ApiProperty() declare scheduledForPurge: number;
  @ApiProperty() declare banned: number;
  @ApiProperty({ nullable: true, format: 'date-time' })
  declare oldestSoftDeleteAt: string | null;
  @ApiProperty({ nullable: true })
  declare daysUntilPurgeForOldest: number | null;
}

class RetentionTripsDto {
  @ApiProperty() declare total: number;
  @ApiProperty() declare archived: number;
}

class RetentionSafetyDto {
  @ApiProperty() declare activeSos: number;
  @ApiProperty() declare resolvedSos: number;
  @ApiProperty() declare pendingScamReports: number;
  @ApiProperty() declare verifiedScamReports: number;
}

class RetentionInboxDto {
  @ApiProperty() declare notifications: number;
  @ApiProperty() declare archivedNotifications: number;
}

class RetentionAppealsDto {
  @ApiProperty() declare pending: number;
  @ApiProperty() declare approved: number;
  @ApiProperty() declare rejected: number;
}

class RetentionStatsResponseDto {
  @ApiProperty({ description: 'Retention window in days (default 7).' })
  declare retentionDays: number;
  @ApiProperty({ type: RetentionUsersDto }) declare users: RetentionUsersDto;
  @ApiProperty({ type: RetentionTripsDto }) declare trips: RetentionTripsDto;
  @ApiProperty({ type: RetentionSafetyDto }) declare safety: RetentionSafetyDto;
  @ApiProperty({ type: RetentionInboxDto }) declare inbox: RetentionInboxDto;
  @ApiProperty({ type: RetentionAppealsDto }) declare appeals: RetentionAppealsDto;
  @ApiProperty({ format: 'date-time' }) declare computedAt: string;
}

class TakedownRowDto {
  @ApiProperty({ format: 'cuid' }) declare id: string;
  @ApiProperty({ format: 'cuid', nullable: true })
  declare actorId: string | null;
  @ApiProperty() declare targetType: string;
  @ApiProperty() declare targetId: string;
  @ApiProperty() declare action: string;
  @ApiProperty({ nullable: true, type: 'object', additionalProperties: true })
  declare context: Record<string, unknown> | null;
  @ApiProperty({ format: 'date-time' }) declare createdAt: string;
}

class TakedownListResponseDto {
  @ApiProperty({ type: [TakedownRowDto] }) declare rows: TakedownRowDto[];
  @ApiProperty() declare total: number;
}

interface TakedownJson {
  readonly id: string;
  readonly actorId: string | null;
  readonly targetType: string;
  readonly targetId: string;
  readonly action: string;
  readonly context: Record<string, unknown> | null;
  readonly createdAt: string;
}

function toTakedownJson(r: AdminAuditLog): TakedownJson {
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

@ApiTags('compliance')
@ApiBearerAuth()
@Controller('compliance')
@Roles('compliance', 'admin')
export class ComplianceController {
  constructor(
    private readonly retentionUc: GetRetentionStatsUseCase,
    private readonly takedownsUc: ListTakedownsUseCase,
  ) {}

  @ApiOperation({
    summary:
      'V.UX.37 — retention dashboard: 16 indexed counts (users / trips / safety / inbox / appeals) + oldest-soft-delete age.',
  })
  @ApiResponse({ status: 200, description: 'Counts.', type: RetentionStatsResponseDto })
  @Get('retention')
  @HttpCode(HttpStatus.OK)
  async retention(): Promise<RetentionStatsResponseDto> {
    const stats = await this.retentionUc.execute();
    return stats as unknown as RetentionStatsResponseDto;
  }

  @ApiOperation({
    summary:
      'V.UX.37 — takedown report: AdminAuditLog scoped to delete_media | delete_trip | archive_trip | dismiss_scam. Newest-first.',
  })
  @ApiResponse({
    status: 200,
    description: 'Takedown rows + total.',
    type: TakedownListResponseDto,
  })
  @Get('takedowns')
  @HttpCode(HttpStatus.OK)
  async takedowns(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ rows: TakedownJson[]; total: number }> {
    const parsedLimit = limit ? Math.max(1, Math.min(500, Number(limit) || 100)) : undefined;
    const parsedOffset = offset ? Math.max(0, Number(offset) || 0) : undefined;
    const result = await this.takedownsUc.execute({
      ...(parsedLimit !== undefined ? { limit: parsedLimit } : {}),
      ...(parsedOffset !== undefined ? { offset: parsedOffset } : {}),
    });
    return { rows: result.rows.map(toTakedownJson), total: result.total };
  }
}
