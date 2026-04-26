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

  @ApiProperty({ enum: ['image', 'video'], description: 'Media type discriminator.' })
  declare kind: string;

  @ApiProperty({
    enum: ['pending', 'ready', 'failed'],
    description: 'Upload lifecycle status.',
  })
  declare status: string;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;
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
