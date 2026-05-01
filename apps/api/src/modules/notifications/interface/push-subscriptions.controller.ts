/**
 * V.UX.26 — Web Push subscription surface.
 *
 *   POST   /api/v1/notifications/push/subscribe    — register or refresh
 *   DELETE /api/v1/notifications/push/subscribe    — owner-scoped revoke
 *
 * Body shape mirrors `PushSubscription.toJSON()` from the browser:
 *   { endpoint, keys: { p256dh, auth } }.
 *
 * Installed by prompt [V.UX.26].
 */
import { Body, Controller, Delete, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { type AuthenticatedUser, CurrentUser } from '../../../common/auth';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { SubscribePushUseCase } from '../application/subscribe-push.use-case';
import { UnsubscribePushUseCase } from '../application/unsubscribe-push.use-case';
import {
  PushSubscriptionDto as PushSubscriptionResponseDto,
  SubscribePushBodySchema,
  SubscribePushRequestDto,
  type SubscribePushBody,
  UnsubscribePushBodySchema,
  UnsubscribePushRequestDto,
  type UnsubscribePushBody,
} from './dto/push-subscription.dto';
import type { PushSubscription } from '../domain/push-subscription.entity';

interface PushSubscriptionDto {
  readonly id: string;
  readonly userId: string;
  readonly endpoint: string;
  readonly createdAt: string;
}

function toDto(s: PushSubscription): PushSubscriptionDto {
  return {
    id: s.id,
    userId: s.userId,
    endpoint: s.endpoint,
    createdAt: s.createdAt.toISOString(),
  };
}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications/push')
export class PushSubscriptionsController {
  constructor(
    private readonly subscribeUc: SubscribePushUseCase,
    private readonly unsubscribeUc: UnsubscribePushUseCase,
  ) {}

  @ApiOperation({
    summary:
      'Register or refresh a Web Push subscription. Idempotent on endpoint — re-subscribing the same browser takes ownership.',
  })
  @ApiBody({ type: SubscribePushRequestDto })
  @ApiResponse({
    status: 201,
    description: 'Subscription stored.',
    type: PushSubscriptionResponseDto,
  })
  @ApiResponse({ status: 422, description: 'VALIDATION_FAILED.' })
  @Post('subscribe')
  @HttpCode(HttpStatus.CREATED)
  async subscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(SubscribePushBodySchema)) body: SubscribePushBody,
  ): Promise<PushSubscriptionDto> {
    const sub = await this.subscribeUc.execute({
      userId: user.sub,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
    });
    return toDto(sub);
  }

  @ApiOperation({
    summary: 'Owner-scoped Web Push unsubscribe. 404 if the endpoint is not registered to caller.',
  })
  @ApiBody({ type: UnsubscribePushRequestDto })
  @ApiResponse({ status: 204, description: 'Unsubscribed.' })
  @ApiResponse({ status: 404, description: 'PUSH_SUBSCRIPTION_NOT_FOUND.' })
  @Delete('subscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsubscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(UnsubscribePushBodySchema)) body: UnsubscribePushBody,
  ): Promise<void> {
    await this.unsubscribeUc.execute({ userId: user.sub, endpoint: body.endpoint });
  }
}
