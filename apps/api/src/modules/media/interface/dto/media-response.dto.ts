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
