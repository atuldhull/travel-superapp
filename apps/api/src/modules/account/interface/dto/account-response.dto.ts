/**
 * Class-based response DTOs for the Account / GDPR HTTP surface.
 * Documentation-only — controllers still return plain object literals.
 *
 * The export bundle is ~30 sections deep (see
 * `domain/user-data-export.entity.ts`). We type the top-level
 * envelope + the metadata header here, but keep the per-section
 * row shapes as open `additionalProperties: true` objects to keep
 * the swagger payload manageable. Downstream tooling can deepen
 * specific sections in follow-up slices if a real consumer needs
 * one strongly typed.
 *
 * Installed by prompt [IV.18.19.57].
 */
import { ApiProperty } from '@nestjs/swagger';

export class UserDataExportMetadataDto {
  @ApiProperty({
    format: 'date-time',
    description: 'ISO-8601 timestamp of when the bundle was generated.',
  })
  declare exportedAt: string;

  @ApiProperty({ enum: [1], description: 'Bundle format version. Bumps on shape changes.' })
  declare formatVersion: number;

  @ApiProperty({ format: 'cuid' })
  declare userId: string;
}

export class UserDataExportResponseDto {
  @ApiProperty({ type: UserDataExportMetadataDto })
  declare metadata: UserDataExportMetadataDto;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Identity bloc — { user, preferences, sessions, devices, oauthIdentities, mfaBackupCodes }. ' +
      'Per-row shapes documented in user-data-export.entity.ts.',
  })
  declare identity: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Trips section — { count, rows[] }. Row shape: ExportedTrip in user-data-export.entity.ts.',
  })
  declare trips: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Itinerary days — { count, rows[] }.',
  })
  declare itineraryDays: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Itinerary items — { count, rows[] }.',
  })
  declare itineraryItems: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  declare tripVersions: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  declare tripShares: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  declare scamReports: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  declare sosEvents: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'Notification preferences row, or null if never set.',
  })
  declare notificationPreference: Record<string, unknown> | null;

  @ApiProperty({ type: 'object', additionalProperties: true })
  declare notificationLogs: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  declare mediaAssets: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  declare memoryBooks: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  declare votes: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  declare expenses: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  declare reviews: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  declare dishReports: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  declare stayBookings: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  declare subscriptions: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  declare escrowHolds: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  declare commissions: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'Agent profile row if the user is a verified agent, else null.',
  })
  declare agentProfile: Record<string, unknown> | null;

  @ApiProperty({ type: 'object', additionalProperties: true })
  declare liveEvents: Record<string, unknown>;
}

/**
 * V.UX.32 — per-category storage stats for the /account/privacy hub.
 * Each field is the row count of the named category for the caller.
 */
export class StorageStatsResponseDto {
  @ApiProperty({ description: 'Active (non-archived) trips.' })
  declare trips: number;

  @ApiProperty({ description: 'Soft-archived trips (V.UX.30).' })
  declare tripsArchived: number;

  @ApiProperty()
  declare itineraryDays: number;

  @ApiProperty()
  declare itineraryItems: number;

  @ApiProperty({ description: 'Photos + videos uploaded by the caller.' })
  declare mediaAssets: number;

  @ApiProperty()
  declare memoryBooks: number;

  @ApiProperty()
  declare reviews: number;

  @ApiProperty()
  declare votes: number;

  @ApiProperty()
  declare expenses: number;

  @ApiProperty({ description: 'V.UX.13 trusted contacts.' })
  declare trustedContacts: number;

  @ApiProperty()
  declare notifications: number;

  @ApiProperty({ description: 'V.UX.26 Web Push subscriptions.' })
  declare pushSubscriptions: number;

  @ApiProperty()
  declare sosEvents: number;

  @ApiProperty()
  declare scamReports: number;

  @ApiProperty()
  declare dishReports: number;

  @ApiProperty({ description: 'Linked OAuth identities (Google, Apple, etc.).' })
  declare oauthIdentities: number;

  @ApiProperty({ description: 'V.UX.25 helpful votes the user has cast.' })
  declare helpfulVotes: number;

  @ApiProperty({
    format: 'date-time',
    description: 'ISO timestamp the stats were computed at.',
  })
  declare computedAt: string;
}
