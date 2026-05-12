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
  Inject,
  Param,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles, type AuthenticatedUser } from '../../../common/auth';
import { AdminDeleteMediaUseCase } from '../application/admin-delete-media.use-case';
import { AdminListMediaUseCase } from '../application/admin-list-media.use-case';
import { STORAGE_PROVIDER, type StorageProvider } from '../application/ports/storage-provider';
import type {
  MediaAsset,
  MediaAssetVariant,
  MediaKind,
  MediaStatus,
} from '../domain/media-asset.entity';
import { AdminListMediaResponseDto } from '../../admin/interface/dto/admin-response.dto';

const VALID_KINDS: readonly MediaKind[] = ['image', 'video'];
const VALID_STATUSES: readonly MediaStatus[] = ['processing', 'ready', 'failed'];

/** POST.5 — short TTL on admin presigned thumb URLs. Long enough to
 *  cover a comfortable session refresh; short enough that a leaked
 *  list response can't be replayed cheaply. */
const THUMB_PRESIGN_TTL_SEC = 15 * 60;

interface AdminMediaVariantDto {
  readonly label: string;
  readonly format: string;
  readonly s3Key: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
}

interface AdminMediaDto {
  readonly id: string;
  readonly ownerId: string;
  readonly tripId: string | null;
  readonly kind: string;
  readonly status: string;
  readonly s3KeyRaw: string;
  readonly createdAt: string;
  /** POST.5 — Sharp-generated variants ([] for legacy / video). */
  readonly variants: readonly AdminMediaVariantDto[];
  /** POST.5 — presigned URL for the thumb variant, or `null` when
   *  no thumb exists yet (video, legacy CDN-backed seed row, or a
   *  fresh image whose pipeline hasn't completed). */
  readonly thumbDownloadUrl: string | null;
}

function variantToDto(v: MediaAssetVariant): AdminMediaVariantDto {
  return {
    label: v.label,
    format: v.format,
    s3Key: v.s3Key,
    width: v.width,
    height: v.height,
    bytes: v.bytes,
  };
}

async function toDto(m: MediaAsset, storage: StorageProvider): Promise<AdminMediaDto> {
  const variants = m.variants ?? [];
  const thumb = variants.find((v) => v.label === 'thumb');
  const thumbDownloadUrl = thumb
    ? await storage.createPresignedDownloadUrl(thumb.s3Key, THUMB_PRESIGN_TTL_SEC)
    : null;
  return {
    id: m.id,
    ownerId: m.ownerId,
    tripId: m.tripId,
    kind: m.kind,
    status: m.status,
    s3KeyRaw: m.s3KeyRaw,
    createdAt: m.createdAt.toISOString(),
    variants: variants.map(variantToDto),
    thumbDownloadUrl,
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
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
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
    const media = await Promise.all(result.rows.map((m) => toDto(m, this.storage)));
    return { media, total: result.total };
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
