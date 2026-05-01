/**
 * V.UX.26 — request + response DTOs for the Web Push subscription
 * surface. The body shape mirrors what `PushSubscription.toJSON()`
 * returns in the browser (endpoint + keys.{p256dh, auth}).
 *
 * Installed by prompt [V.UX.26].
 */
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const SubscribePushBodySchema = z.object({
  endpoint: z.string().url().min(10).max(2048),
  keys: z.object({
    p256dh: z.string().min(10).max(512),
    auth: z.string().min(8).max(256),
  }),
});

export type SubscribePushBody = z.infer<typeof SubscribePushBodySchema>;

export const UnsubscribePushBodySchema = z.object({
  endpoint: z.string().url().min(10).max(2048),
});
export type UnsubscribePushBody = z.infer<typeof UnsubscribePushBodySchema>;

export class SubscribePushKeysDto {
  @ApiProperty({ description: 'Web Push spec §3 — base64 client public key.' })
  declare p256dh: string;

  @ApiProperty({ description: 'Web Push spec §3 — base64 auth secret.' })
  declare auth: string;
}

export class SubscribePushRequestDto {
  @ApiProperty({ description: 'Browser-vendor endpoint URL.' })
  declare endpoint: string;

  @ApiProperty({ type: SubscribePushKeysDto })
  declare keys: SubscribePushKeysDto;
}

export class UnsubscribePushRequestDto {
  @ApiProperty({ description: 'Browser-vendor endpoint URL to unsubscribe.' })
  declare endpoint: string;
}

export class PushSubscriptionDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ format: 'cuid' })
  declare userId: string;

  @ApiProperty()
  declare endpoint: string;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;
}
