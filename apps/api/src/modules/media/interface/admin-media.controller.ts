/**
 * Admin media moderation HTTP surface.
 *
 *   GET    /api/v1/admin/media?ownerId=&kind=&status=&limit=&offset=
 *   DELETE /api/v1/admin/media/:id
 *
 * Class-level `@Roles('admin')` gates every method. Lives in
 * MediaModule — admin-in-owning-module pattern, sixth precedent
 * (after scam moderation, places curation, user moderation,
 * SOS triage, trip moderation).
 *
 * No archive verb here — MediaAsset has no "archived" status
 * (unlike Trip). Admin's only soft-action option is to set
 * `status = 'failed'` which would flag the asset as unusable;
 * not a great moderation semantic. v1 ships hard-delete only.
 *
 * Installed by prompt [IV.18.18.4].
 */
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles, type AuthenticatedUser } from '../../../common/auth';
import { AdminDeleteMediaUseCase } from '../application/admin-delete-media.use-case';
import { AdminListMediaUseCase } from '../application/admin-list-media.use-case';
import type { MediaAsset, MediaKind, MediaStatus } from '../domain/media-asset.entity';
import { AdminListMediaResponseDto } from '../../admin/interface/dto/admin-response.dto';

const VALID_KINDS: readonly MediaKind[] = ['image', 'video'];
const VALID_STATUSES: readonly MediaStatus[] = ['processing', 'ready', 'failed'];

interface AdminMediaDto {
  readonly id: string;
  readonly ownerId: string;
  readonly tripId: string | null;
  readonly kind: string;
  readonly status: string;
  readonly s3KeyRaw: string;
  readonly createdAt: string;
}

function toDto(m: MediaAsset): AdminMediaDto {
  return {
    id: m.id,
    ownerId: m.ownerId,
    tripId: m.tripId,
    kind: m.kind,
    status: m.status,
    s3KeyRaw: m.s3KeyRaw,
    createdAt: m.createdAt.toISOString(),
  };
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/media')
@Roles('admin')
export class AdminMediaController {
  constructor(
    private readonly listUc: AdminListMediaUseCase,
    private readonly deleteUc: AdminDeleteMediaUseCase,
  ) {}

  @ApiOperation({
    summary: 'Cross-user list of media with optional ?ownerId, ?kind, ?status filters. Admin-only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Matching media + total.',
    type: AdminListMediaResponseDto,
  })
  @ApiResponse({ status: 400, description: 'VALIDATION_FAILED — kind / status invalid.' })
  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @Query('ownerId') ownerId?: string,
    @Query('kind') kind?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ media: AdminMediaDto[]; total: number }> {
    let parsedKind: MediaKind | undefined;
    if (kind !== undefined) {
      if (!VALID_KINDS.includes(kind as MediaKind)) {
        throw new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: `kind must be one of: ${VALID_KINDS.join(' | ')}`,
        });
      }
      parsedKind = kind as MediaKind;
    }
    let parsedStatus: MediaStatus | undefined;
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status as MediaStatus)) {
        throw new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: `status must be one of: ${VALID_STATUSES.join(' | ')}`,
        });
      }
      parsedStatus = status as MediaStatus;
    }
    const parsedLimit = limit ? Math.max(1, Math.min(200, Number(limit) || 50)) : undefined;
    const parsedOffset = offset ? Math.max(0, Number(offset) || 0) : undefined;
    const trimmedOwner = ownerId?.trim();

    const result = await this.listUc.execute({
      ...(trimmedOwner !== undefined && trimmedOwner.length > 0 ? { ownerId: trimmedOwner } : {}),
      ...(parsedKind !== undefined ? { kind: parsedKind } : {}),
      ...(parsedStatus !== undefined ? { status: parsedStatus } : {}),
      ...(parsedLimit !== undefined ? { limit: parsedLimit } : {}),
      ...(parsedOffset !== undefined ? { offset: parsedOffset } : {}),
    });
    return { media: result.rows.map(toDto), total: result.total };
  }

  @ApiOperation({
    summary: 'Hard-delete media (takedown). Trip + memory book references SetNull-cascade.',
  })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @ApiResponse({ status: 404, description: 'MEDIA_NOT_FOUND.' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.deleteUc.execute({ actorId: admin.sub, mediaId: id });
  }
}
