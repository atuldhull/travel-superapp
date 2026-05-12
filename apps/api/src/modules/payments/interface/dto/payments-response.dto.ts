/**
 * POST.9 — DTOs for the Stripe payment surface. Documentation-only;
 * runtime validation lives in the controller (controller's body
 * type-casts + ValidationError for the webhook signature header).
 */
import { ApiProperty } from '@nestjs/swagger';

export class CheckoutSessionResponseDto {
  @ApiProperty({ description: 'Stripe Checkout session id (cs_test_… in test mode).' })
  declare sessionId: string;

  @ApiProperty({ description: 'Stripe-hosted URL the client redirects the browser to.' })
  declare url: string;
}

export class WebhookAckResponseDto {
  @ApiProperty({ description: 'Always true on accepted webhooks; absent on 400/503.' })
  declare received: boolean;

  @ApiProperty({ description: 'Stripe event id (evt_… ) for log correlation.' })
  declare eventId: string;
}

export class CurrentSubscriptionDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({
    enum: [
      'trialing',
      'active',
      'past_due',
      'canceled',
      'unpaid',
      'incomplete',
      'incomplete_expired',
      'paused',
    ],
  })
  declare status: string;

  @ApiProperty({ description: 'Price in the smallest currency unit (cents for USD).' })
  declare priceCents: number;

  @ApiProperty({ description: 'ISO 4217 currency code (uppercase).' })
  declare currency: string;

  @ApiProperty({ format: 'date-time' })
  declare currentPeriodEnd: string;

  @ApiProperty()
  declare cancelAtPeriodEnd: boolean;
}

export class CurrentSubscriptionResponseDto {
  @ApiProperty({
    type: CurrentSubscriptionDto,
    nullable: true,
    description: '`null` when the caller has no Subscription row on file.',
  })
  declare subscription: CurrentSubscriptionDto | null;
}

export class PortalUrlResponseDto {
  @ApiProperty({ description: 'One-time Stripe Customer Portal URL.' })
  declare url: string;
}
