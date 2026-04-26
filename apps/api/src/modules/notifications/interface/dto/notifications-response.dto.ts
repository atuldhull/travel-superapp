/**
 * Class-based response DTOs for the Notifications HTTP surface.
 * Documentation-only — controllers still return plain object literals.
 *
 * Installed by prompt [IV.18.19.58].
 */
import { ApiProperty } from '@nestjs/swagger';

export class NotificationLogDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ enum: ['push', 'email', 'sms'] })
  declare channel: string;

  @ApiProperty({ description: 'Template id (e.g. "trip.invited", "sos.acknowledged").' })
  declare templateId: string;

  @ApiProperty({
    enum: ['queued', 'delivered', 'failed', 'skipped'],
    description: 'Lifecycle status of the delivery attempt.',
  })
  declare status: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Template payload (JSON). Shape varies per template id.',
  })
  declare payload: Record<string, unknown>;

  @ApiProperty({ description: 'True once the recipient has read the notification.' })
  declare read: boolean;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;

  @ApiProperty({
    nullable: true,
    format: 'date-time',
    description: 'When the deliver-side adapter reported success; null while queued/failed.',
  })
  declare deliveredAt: string | null;
}

export class ListMyNotificationsResponseDto {
  @ApiProperty({
    type: [NotificationLogDto],
    description:
      "Caller's recent deliveries, newest-first. Capped via ?limit (1..200, default 50).",
  })
  declare notifications: NotificationLogDto[];
}

export class UnreadCountResponseDto {
  @ApiProperty({ description: 'Count of unread rows across all channels.' })
  declare unread: number;
}

export class MarkAllReadResponseDto {
  @ApiProperty({
    description: 'Count of rows actually flipped on this call. 0 on idempotent re-call.',
  })
  declare marked: number;
}
