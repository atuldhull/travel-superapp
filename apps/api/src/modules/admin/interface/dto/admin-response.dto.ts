/**
 * Class-based response DTOs for the cross-domain admin HTTP surfaces.
 * Documentation-only.
 *
 * Installed by prompt [IV.18.19.68].
 */
import { ApiProperty } from '@nestjs/swagger';

// ─── Admin places (curation) ─────────────────────────────────────

export class AdminCreatePlaceRequestDto {
  @ApiProperty({ description: 'Stable provider key (e.g. "internal:rishikesh-001").' })
  declare sourceKey: string;

  @ApiProperty()
  declare name: string;

  @ApiProperty()
  declare category: string;

  @ApiProperty()
  declare lat: number;

  @ApiProperty()
  declare lng: number;

  @ApiProperty({ required: false, nullable: true })
  declare address?: string | null;

  @ApiProperty({ required: false, nullable: true, description: 'ISO 3166-1 alpha-2.' })
  declare countryCode?: string | null;

  @ApiProperty({ required: false, description: 'Curated relaxation score 0..100.' })
  declare relaxationScore?: number;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Free-form JSON metadata blob.',
    additionalProperties: true,
  })
  declare metadata?: Record<string, unknown> | null;
}

export class AdminPlaceDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty()
  declare sourceKey: string;

  @ApiProperty()
  declare name: string;

  @ApiProperty()
  declare category: string;

  @ApiProperty({ nullable: true })
  declare address: string | null;

  @ApiProperty({ nullable: true })
  declare countryCode: string | null;

  @ApiProperty()
  declare relaxationScore: number;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;

  @ApiProperty({ format: 'date-time' })
  declare updatedAt: string;
}

// ─── Admin purge tick ────────────────────────────────────────────

export class AdminPurgeForceResponseDto {
  @ApiProperty({ description: 'Always true on success — the scheduler tick was kicked off.' })
  declare ok: boolean;
}

// ─── Admin users ─────────────────────────────────────────────────

export class AdminUserDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ description: 'sha256(email) — opaque email surrogate.' })
  declare emailHash: string;

  @ApiProperty()
  declare displayName: string;

  @ApiProperty({ enum: ['user', 'premium', 'agent', 'admin'] })
  declare role: string;

  @ApiProperty()
  declare mfaEnabled: boolean;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;

  @ApiProperty({ format: 'date-time' })
  declare updatedAt: string;

  @ApiProperty({
    nullable: true,
    format: 'date-time',
    description: 'Soft-delete timestamp; null if active.',
  })
  declare deletedAt: string | null;
}

export class AdminListUsersResponseDto {
  @ApiProperty({ type: [AdminUserDto] })
  declare users: AdminUserDto[];

  @ApiProperty({ description: 'Total matching rows across all pages.' })
  declare total: number;
}

// ─── Admin media ─────────────────────────────────────────────────

export class AdminMediaDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ format: 'cuid' })
  declare ownerId: string;

  @ApiProperty({ nullable: true, format: 'cuid' })
  declare tripId: string | null;

  @ApiProperty({ enum: ['image', 'video'] })
  declare kind: string;

  @ApiProperty({ enum: ['processing', 'ready', 'failed'] })
  declare status: string;

  @ApiProperty()
  declare s3KeyRaw: string;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;
}

export class AdminListMediaResponseDto {
  @ApiProperty({ type: [AdminMediaDto] })
  declare media: AdminMediaDto[];

  @ApiProperty()
  declare total: number;
}
