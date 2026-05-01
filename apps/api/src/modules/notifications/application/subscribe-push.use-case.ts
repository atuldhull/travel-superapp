/**
 * V.UX.26 — accept a Web Push subscription from the client. Idempotent
 * upsert on `endpoint` (browser endpoints are install-scoped, not
 * user-scoped — re-subscribing under a different account takes
 * ownership).
 *
 * Installed by prompt [V.UX.26].
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  PUSH_SUBSCRIPTION_REPOSITORY,
  type PushSubscriptionRepository,
} from './ports/push-subscription.repository';
import type { PushSubscription } from '../domain/push-subscription.entity';

export interface SubscribePushCommand {
  readonly userId: string;
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
}

@Injectable()
export class SubscribePushUseCase {
  constructor(
    @Inject(PUSH_SUBSCRIPTION_REPOSITORY)
    private readonly repo: PushSubscriptionRepository,
  ) {}

  execute(cmd: SubscribePushCommand): Promise<PushSubscription> {
    return this.repo.upsertByEndpoint(cmd);
  }
}
