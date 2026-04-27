/**
 * Class-based response DTOs for the owner-scoped Media surface.
 * Documentation-only; controllers still return plain object literals.
 *
 * Installed by prompt [IV.18.19.40].
 */
import { ApiProperty } from '@nestjs/swagger';

export class MediaAssetDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ format: 'cuid', description: "Owner's user id." })
  declare ownerId: string;

  @ApiProperty({
    nullable: true,
    format: 'cuid',
    description: 'Trip the asset is attached to, or null if free-floating.',
  })
  declare tripId: string | null;

  @ApiProperty({
    nullable: true,
    format: 'cuid',
    description: 'Memory book the asset is attached to, or null if free-floating.',
  })
  declare memoryBookId: string | null;

  @ApiProperty({ enum: ['image', 'video'], description: 'Media type discriminator.' })
  declare kind: string;

  @ApiProperty({
    enum: ['pending', 'ready', 'failed'],
    description: 'Upload lifecycle status.',
  })
  declare status: string;

  @ApiProperty({
    nullable: true,
    maxLength: 280,
    description: 'V.UX.11 — owner-authored caption shown in story mode. Null = blank.',
  })
  declare caption: string | null;

  @ApiProperty({
    description: 'V.UX.11 — sort order within the memory book (0-based).',
  })
  declare position: number;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;
}

/** Body for `PATCH /memory-books/:id/assets/:assetId/caption`. */
export class UpdateAssetCaptionRequestDto {
  @ApiProperty({
    nullable: true,
    maxLength: 280,
    description: 'New caption. Null or blank clears the field.',
  })
  declare caption: string | null;
}

export class ListTripMediaResponseDto {
  @ApiProperty({
    type: [MediaAssetDto],
    description:
      'Caller-owned media attached to the given trip, most-recent-first. Capped via ?limit (1..200, default 50).',
  })
  declare media: MediaAssetDto[];
}

/** Body for `POST /media/upload-url`. Documentation-only. */
export class CreateUploadUrlRequestDto {
  @ApiProperty({ enum: ['image', 'video'] })
  declare kind: string;

  @ApiProperty({ description: 'MIME type (e.g. "image/jpeg").', minLength: 1, maxLength: 120 })
  declare contentType: string;

  @ApiProperty({
    required: false,
    format: 'cuid',
    description: 'Optional trip to attach to immediately.',
  })
  declare tripId?: string;
}

export class CreateUploadUrlResponseDto {
  @ApiProperty({ format: 'cuid' })
  declare mediaAssetId: string;

  @ApiProperty({ description: 'Presigned PUT URL. Body must be the raw file bytes.' })
  declare uploadUrl: string;

  @ApiProperty({ description: 'S3 object key, useful for diagnostics.' })
  declare key: string;

  @ApiProperty({ enum: ['PUT'] })
  declare method: string;

  @ApiProperty({ format: 'date-time', description: 'When the presigned URL expires.' })
  declare expiresAt: string;

  @ApiProperty({ type: MediaAssetDto, description: 'Initial asset row (status: pending).' })
  declare asset: MediaAssetDto;
}

/** Body for `PATCH /media/:id/trip`. Pass null to detach. */
export class AttachMediaToTripRequestDto {
  @ApiProperty({
    nullable: true,
    format: 'cuid',
    description: 'Trip id to attach the asset to. Pass null to detach.',
  })
  declare tripId: string | null;
}

/** Body for `PATCH /media/:id/memory-book`. Pass null to detach. */
export class AttachMediaToBookRequestDto {
  @ApiProperty({
    nullable: true,
    format: 'cuid',
    description: 'Memory-book id to attach the asset to. Pass null to detach.',
  })
  declare memoryBookId: string | null;
}

/** Response for `GET /media/:id/download-url`. Owner-scoped twin of `PublicDownloadUrlResponseDto`. */
export class MediaDownloadUrlResponseDto {
  @ApiProperty({
    description: 'Short-lived presigned GET URL for the asset bytes. Owner-gated. TTL ~5 min.',
  })
  declare url: string;

  @ApiProperty({
    format: 'date-time',
    description: 'ISO-8601 timestamp at which the presigned URL expires.',
  })
  declare expiresAt: string;
}
