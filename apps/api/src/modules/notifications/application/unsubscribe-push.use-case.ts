/**
 * V.UX.26 — owner-scoped Web Push unsubscribe. Returns 404 only on
 * actual not-found (the row never existed under this user); the
 * route's contract is "succeed when the endpoint is gone for this
 * user", so duplicate calls are safe.
 *
 * Installed by prompt [V.UX.26].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import {
  PUSH_SUBSCRIPTION_REPOSITORY,
  type PushSubscriptionRepository,
} from './ports/push-subscription.repository';

export interface UnsubscribePushCommand {
  readonly userId: string;
  readonly endpoint: string;
}

@Injectable()
export class UnsubscribePushUseCase {
  constructor(
    @Inject(PUSH_SUBSCRIPTION_REPOSITORY)
    private readonly repo: PushSubscriptionRepository,
  ) {}

  async execute(cmd: UnsubscribePushCommand): Promise<void> {
    const ok = await this.repo.deleteByEndpoint(cmd.userId, cmd.endpoint);
    if (!ok) {
      throw new NotFoundError(
        'Push subscription not found',
        { endpoint: cmd.endpoint },
        'PUSH_SUBSCRIPTION_NOT_FOUND',
      );
    }
  }
}
