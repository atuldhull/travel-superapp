/**
 * Admin trip moderation HTTP surface.
 *
 *   GET  /api/v1/admin/trips?q=&status=&limit=&offset=
 *   POST /api/v1/admin/trips/:id/archive
 *   DELETE /api/v1/admin/trips/:id
 *
 * Class-level `@Roles('admin')` gates every method. Lives in
 * TripModule — admin-in-owning-module pattern, same as scam
 * moderation (Safety) + user moderation (Account) + SOS triage
 * (Safety) + force-purge (Account).
 *
 * Archive flips `status = 'archived'` (soft moderation; trip
 * stays in DB so owner can unarchive via the existing CRUD path).
 * Delete is hard — for clearly-abusive takedowns. Schema-level
 * cascade wipes itinerary + child rows.
 *
 * Installed by prompt [IV.18.18.3].
 */
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/auth';
import { AdminArchiveTripUseCase } from '../application/admin-archive-trip.use-case';
import { AdminDeleteTripUseCase } from '../application/admin-delete-trip.use-case';
import { AdminListTripsUseCase } from '../application/admin-list-trips.use-case';
import type { Trip, TripStatus } from '../domain/trip.entity';

const VALID_STATUSES: readonly TripStatus[] = ['draft', 'published', 'archived'];

interface AdminTripDto {
  readonly id: string;
  readonly userId: string;
  readonly title: string;
  readonly status: string;
  readonly radiusKm: number;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function toDto(t: Trip): AdminTripDto {
  return {
    id: t.id,
    userId: t.userId,
    title: t.title,
    status: t.status,
    radiusKm: t.radiusKm,
    startsOn: t.startsOn ? t.startsOn.toISOString() : null,
    endsOn: t.endsOn ? t.endsOn.toISOString() : null,
    version: t.version,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/trips')
@Roles('admin')
export class AdminTripsController {
  constructor(
    private readonly listUc: AdminListTripsUseCase,
    private readonly archiveUc: AdminArchiveTripUseCase,
    private readonly deleteUc: AdminDeleteTripUseCase,
  ) {}

  @ApiOperation({
    summary: 'List trips across all users with optional q + status filters. Admin-only.',
  })
  @ApiResponse({ status: 200, description: 'Paginated trip rows.' })
  @ApiResponse({ status: 403, description: 'Caller is not admin.' })
  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ trips: AdminTripDto[]; total: number }> {
    let parsedStatus: TripStatus | undefined;
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status as TripStatus)) {
        throw new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: `status must be one of: ${VALID_STATUSES.join(' | ')}`,
        });
      }
      parsedStatus = status as TripStatus;
    }
    const parsedLimit = limit ? Math.max(1, Math.min(200, Number(limit) || 50)) : undefined;
    const parsedOffset = offset ? Math.max(0, Number(offset) || 0) : undefined;
    const trimmedQ = q?.trim();
    const result = await this.listUc.execute({
      ...(trimmedQ !== undefined && trimmedQ.length > 0 ? { q: trimmedQ } : {}),
      ...(parsedStatus !== undefined ? { status: parsedStatus } : {}),
      ...(parsedLimit !== undefined ? { limit: parsedLimit } : {}),
      ...(parsedOffset !== undefined ? { offset: parsedOffset } : {}),
    });
    return { trips: result.rows.map(toDto), total: result.total };
  }

  @ApiOperation({
    summary:
      'Soft-archive a trip (status = archived). Reversible by the owner via the standard CRUD path.',
  })
  @ApiResponse({ status: 204, description: 'Trip archived.' })
  @Post(':id/archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  async archive(@Param('id') id: string): Promise<void> {
    await this.archiveUc.execute(id);
  }

  @ApiOperation({
    summary: 'Hard-delete a trip + cascade itinerary. For takedowns of clearly-abusive content.',
  })
  @ApiResponse({ status: 204, description: 'Trip deleted.' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.deleteUc.execute(id);
  }
}
