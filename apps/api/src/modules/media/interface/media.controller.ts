/**
 * Media HTTP surface for v1.
 *
 *   POST   /api/v1/media/upload-url       — issue presigned PUT
 *   POST   /api/v1/media/:id/confirm      — flip row to `ready`
 *   GET    /api/v1/media/:id/download-url — short-lived GET URL
 *
 * All three routes are authenticated + owner-gated. IDOR defence
 * is uniform 404 on wrong-owner — never 403, which would leak
 * existence of someone else's asset id.
 *
 * Installed by prompt [IV.18.12.1].
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { type AuthenticatedUser, CurrentUser } from '../../../common/auth';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { ConfirmUploadUseCase } from '../application/confirm-upload.use-case';
import { CreateUploadUrlUseCase } from '../application/create-upload-url.use-case';
import { GetMediaDownloadUrlUseCase } from '../application/get-media-download-url.use-case';
import type { MediaAsset } from '../domain/media-asset.entity';
import { CreateUploadUrlBodySchema, type CreateUploadUrlBody } from './dto/media.dto';

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

@Controller('media')
export class MediaController {
  constructor(
    private readonly createUploadUrlUc: CreateUploadUrlUseCase,
    private readonly confirmUc: ConfirmUploadUseCase,
    private readonly downloadUc: GetMediaDownloadUrlUseCase,
  ) {}

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

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  async confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<MediaAssetDto> {
    const asset = await this.confirmUc.execute({ id, ownerId: user.sub });
    return toDto(asset);
  }

  @Get(':id/download-url')
  @HttpCode(HttpStatus.OK)
  async downloadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ url: string; expiresAt: string }> {
    const { url, expiresAt } = await this.downloadUc.execute({ id, ownerId: user.sub });
    return { url, expiresAt: expiresAt.toISOString() };
  }
}
