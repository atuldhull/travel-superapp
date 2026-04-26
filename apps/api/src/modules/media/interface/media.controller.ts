/**
 * Media HTTP surface.
 *
 *   POST   /api/v1/media/upload-url        — issue presigned PUT
 *   POST   /api/v1/media/:id/confirm       — flip row to `ready`
 *   GET    /api/v1/media/:id/download-url  — short-lived GET URL
 *   PATCH  /api/v1/media/:id/trip          — attach / detach trip
 *   GET    /api/v1/media/trip/:tripId      — list my media for trip
 *
 * Every route is authenticated + owner-gated. IDOR defence is
 * uniform 404 on wrong-owner — never 403, which would leak
 * existence of someone else's asset id.
 *
 * Installed by prompt [IV.18.12.1]; trip-attachment surface added
 * in [IV.18.12.2].
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ListTripMediaResponseDto } from './dto/media-response.dto';
import { type AuthenticatedUser, CurrentUser } from '../../../common/auth';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { AttachMediaToBookUseCase } from '../application/attach-media-to-book.use-case';
import { AttachMediaToTripUseCase } from '../application/attach-media-to-trip.use-case';
import { ConfirmUploadUseCase } from '../application/confirm-upload.use-case';
import { CreateUploadUrlUseCase } from '../application/create-upload-url.use-case';
import { GetMediaDownloadUrlUseCase } from '../application/get-media-download-url.use-case';
import { ListTripMediaUseCase } from '../application/list-trip-media.use-case';
import type { MediaAsset } from '../domain/media-asset.entity';
import {
  AttachMediaToBookBodySchema,
  AttachMediaToTripBodySchema,
  CreateUploadUrlBodySchema,
  type AttachMediaToBookBody,
  type AttachMediaToTripBody,
  type CreateUploadUrlBody,
} from './dto/media.dto';

interface MediaAssetDto {
  readonly id: string;
  readonly ownerId: string;
  readonly tripId: string | null;
  readonly kind: string;
  readonly status: string;
  readonly createdAt: string;
}

function toDto(a: MediaAsset): MediaAssetDto {
  return {
    id: a.id,
    ownerId: a.ownerId,
    tripId: a.tripId,
    kind: a.kind,
    status: a.status,
    createdAt: a.createdAt.toISOString(),
  };
}

@ApiTags('media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(
    private readonly createUploadUrlUc: CreateUploadUrlUseCase,
    private readonly confirmUc: ConfirmUploadUseCase,
    private readonly downloadUc: GetMediaDownloadUrlUseCase,
    private readonly attachUc: AttachMediaToTripUseCase,
    private readonly listTripUc: ListTripMediaUseCase,
    private readonly attachBookUc: AttachMediaToBookUseCase,
  ) {}

  @ApiOperation({
    summary:
      'Issue a presigned PUT URL for direct-to-S3 upload. Creates the MediaAsset row in `processing` status.',
  })
  @Post('upload-url')
  @HttpCode(HttpStatus.CREATED)
  async createUploadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(CreateUploadUrlBodySchema)) body: CreateUploadUrlBody,
  ): Promise<{
    mediaAssetId: string;
    uploadUrl: string;
    key: string;
    method: 'PUT';
    expiresAt: string;
    asset: MediaAssetDto;
  }> {
    const { asset, uploadUrl, expiresAt } = await this.createUploadUrlUc.execute({
      ownerId: user.sub,
      kind: body.kind,
      contentType: body.contentType,
      tripId: body.tripId ?? null,
    });
    return {
      mediaAssetId: asset.id,
      uploadUrl,
      key: asset.s3KeyRaw,
      method: 'PUT',
      expiresAt: expiresAt.toISOString(),
      asset: toDto(asset),
    };
  }

  @ApiOperation({
    summary:
      'Confirm upload landed (HEAD verifies bytes). Flips status to `ready`. Image kind also flips exifStripped.',
  })
  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  async confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<MediaAssetDto> {
    const asset = await this.confirmUc.execute({ id, ownerId: user.sub });
    return toDto(asset);
  }

  @ApiOperation({ summary: 'Short-lived presigned GET URL for the asset. Owner-gated.' })
  @Get(':id/download-url')
  @HttpCode(HttpStatus.OK)
  async downloadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ url: string; expiresAt: string }> {
    const { url, expiresAt } = await this.downloadUc.execute({ id, ownerId: user.sub });
    return { url, expiresAt: expiresAt.toISOString() };
  }

  /**
   * Attach this media to a trip (`{ tripId: "cuid" }`) or detach
   * it (`{ tripId: null }`). Double owner-gated — both the media
   * AND the trip (when attaching) must belong to the caller.
   * Wrong-owner on either side → 404 with the corresponding code.
   */
  @ApiOperation({
    summary:
      'Attach (`{tripId}`) or detach (`{tripId:null}`) the media to a trip. Double owner-gated.',
  })
  @Patch(':id/trip')
  @HttpCode(HttpStatus.OK)
  async attachToTrip(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AttachMediaToTripBodySchema)) body: AttachMediaToTripBody,
  ): Promise<MediaAssetDto> {
    const asset = await this.attachUc.execute({
      mediaId: id,
      ownerId: user.sub,
      tripId: body.tripId,
    });
    return toDto(asset);
  }

  /**
   * List the caller's `ready` media attached to a trip. Ready-only
   * so clients never render a broken thumbnail while a fresh
   * upload is mid-confirm. `?limit=N` (1..200, default 50).
   */
  @ApiOperation({
    summary: "List the caller's `ready` media attached to a trip. ?limit=N (1..200, default 50).",
  })
  @ApiResponse({
    status: 200,
    description: 'Caller-owned media for the given trip.',
    type: ListTripMediaResponseDto,
  })
  @Get('trip/:tripId')
  @HttpCode(HttpStatus.OK)
  async listByTrip(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId') tripId: string,
    @Query('limit') limit?: string,
  ): Promise<{ media: MediaAssetDto[] }> {
    const parsed = limit ? Math.max(1, Math.min(200, Number(limit) || 50)) : 50;
    const assets = await this.listTripUc.execute({
      tripId,
      ownerId: user.sub,
      limit: parsed,
    });
    return { media: assets.map(toDto) };
  }

  /**
   * Attach this media to a memory book (`{ memoryBookId: "cuid" }`)
   * or detach it (`{ memoryBookId: null }`). Double owner-gated —
   * both the media AND the book (when attaching) must belong to
   * the caller. Wrong-owner on either side → 404 with the
   * corresponding code.
   */
  @ApiOperation({
    summary:
      'Attach (`{memoryBookId}`) or detach (`{memoryBookId:null}`) the media to a memory book. Double owner-gated.',
  })
  @Patch(':id/memory-book')
  @HttpCode(HttpStatus.OK)
  async attachToBook(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AttachMediaToBookBodySchema)) body: AttachMediaToBookBody,
  ): Promise<MediaAssetDto> {
    const asset = await this.attachBookUc.execute({
      mediaId: id,
      ownerId: user.sub,
      memoryBookId: body.memoryBookId,
    });
    return toDto(asset);
  }
}
