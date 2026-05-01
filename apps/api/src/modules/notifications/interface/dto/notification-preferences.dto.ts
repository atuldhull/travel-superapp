/**
 * V.UX.26 — request + response DTOs for the notification-preferences
 * surface. Class-based for Swagger; Zod schema validates the body.
 *
 * Installed by prompt [V.UX.26].
 */
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';
import { NOTIFICATION_CATEGORIES } from '../../domain/notification-preference.entity';

export const UpdateNotificationPreferencesBodySchema = z.object({
  push: z.boolean().optional(),
  email: z.boolean().optional(),
  sms: z.boolean().optional(),
  categoriesDisabled: z
    .array(z.enum(NOTIFICATION_CATEGORIES))
    .max(NOTIFICATION_CATEGORIES.length)
    .optional(),
});

export type UpdateNotificationPreferencesBody = z.infer<
  typeof UpdateNotificationPreferencesBodySchema
>;

export class UpdateNotificationPreferencesRequestDto {
  @ApiProperty({ required: false, description: 'Global push channel toggle.' })
  declare push?: boolean;

  @ApiProperty({ required: false, description: 'Global email channel toggle.' })
  declare email?: boolean;

  @ApiProperty({ required: false, description: 'Global SMS channel toggle.' })
  declare sms?: boolean;

  @ApiProperty({
    required: false,
    type: [String],
    enum: NOTIFICATION_CATEGORIES,
    description:
      'Categories the user has opted out of. Empty array = all categories on (the default).',
  })
  declare categoriesDisabled?: string[];
}

export class NotificationPreferencesDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ format: 'cuid' })
  declare userId: string;

  @ApiProperty()
  declare push: boolean;

  @ApiProperty()
  declare email: boolean;

  @ApiProperty()
  declare sms: boolean;

  @ApiProperty({ type: [String], enum: NOTIFICATION_CATEGORIES })
  declare categoriesDisabled: string[];

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;

  @ApiProperty({ format: 'date-time' })
  declare updatedAt: string;
}
