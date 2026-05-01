/**
 * V.UX.26 — fans out a payload to every Web Push subscription
 * registered for a recipient. When VAPID keys aren't configured
 * (dev / test) the dispatcher logs + no-ops so the rest of the
 * notification pipeline still works.
 *
 * Failure isolation: per-subscription `web-push.sendNotification`
 * errors are swallowed. A 404/410 response from the browser vendor
 * means the endpoint is dead → the subscription is reaped through
 * `PushSubscriptionRepository.deleteExpiredEndpoint` so we stop
 * paying the round-trip on every future fan-out.
 *
 * Installed by prompt [V.UX.26].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webPush from 'web-push';
import type { Env } from '@app/config';
import { createLogger } from '@app/logger';
import {
  PUSH_SUBSCRIPTION_REPOSITORY,
  type PushSubscriptionRepository,
} from '../application/ports/push-subscription.repository';

const log = createLogger('notifications.web-push');

export interface WebPushPayload {
  readonly title: string;
  readonly body: string;
  readonly url?: string;
  readonly templateKey: string;
  readonly context: Readonly<Record<string, unknown>>;
}

@Injectable()
export class WebPushDispatcher {
  private readonly enabled: boolean;

  constructor(
    @Inject(ConfigService) config: ConfigService<Env, true>,
    @Inject(PUSH_SUBSCRIPTION_REPOSITORY)
    private readonly repo: PushSubscriptionRepository,
  ) {
    const publicKey = config.get('VAPID_PUBLIC_KEY', { infer: true });
    const privateKey = config.get('VAPID_PRIVATE_KEY', { infer: true });
    const subject = config.get('VAPID_SUBJECT', { infer: true });
    if (publicKey && privateKey) {
      webPush.setVapidDetails(subject, publicKey, privateKey);
      this.enabled = true;
    } else {
      this.enabled = false;
    }
  }

  async dispatchToUser(userId: string, payload: WebPushPayload): Promise<void> {
    if (!this.enabled) {
      log.debug({ userId, template: payload.templateKey }, 'web_push_disabled_no_vapid');
      return;
    }
    const subs = await this.repo.listForUser(userId);
    if (subs.length === 0) return;
    const body = JSON.stringify(payload);
    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webPush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body,
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            log.info({ endpoint: sub.endpoint }, 'web_push_endpoint_gone_reaping');
            await this.repo.deleteExpiredEndpoint(sub.endpoint);
            return;
          }
          log.warn(
            {
              err: err instanceof Error ? err.message : String(err),
              endpoint: sub.endpoint,
              status,
            },
            'web_push_send_failed',
          );
        }
      }),
    );
  }
}
