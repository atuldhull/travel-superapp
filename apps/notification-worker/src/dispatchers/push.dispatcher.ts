/**
 * Push dispatcher — web-push (VAPID) wrapper.
 *
 * Reads `subscriptionJson / title / body / url?` from the job's `vars`.
 * `subscriptionJson` is the serialised browser PushSubscription
 * (`{ endpoint, keys: { p256dh, auth } }`); we JSON-encode it producer-side
 * because the job payload schema in `@app/jobs` constrains vars to
 * `Record<string, string | number | boolean | null>`.
 *
 * Disabled when any VAPID env var is missing; expired subscriptions
 * (410 / 404) are logged + treated as success so BullMQ doesn't retry
 * a tombstoned subscription forever (the producer should mark the
 * subscription dead via a separate path — not the worker's job).
 *
 * Installed by [S-B1] of the S-series real-functionality closeout.
 */
import { CircuitBreaker } from '@app/resilience';
import { SYSTEM_CLOCK } from '@app/clock';
import webpush, { type PushSubscription, type WebPushError } from 'web-push';
import type { AppLogger } from '@app/logger';
import type { NotificationVars } from './types';

export interface PushDispatcherOptions {
  publicKey: string | undefined;
  privateKey: string | undefined;
  subject: string | undefined;
}

export class PushDispatcher {
  private readonly enabledFlag: boolean;
  private readonly breaker: CircuitBreaker;

  constructor(opts: PushDispatcherOptions) {
    if (opts.publicKey && opts.privateKey && opts.subject) {
      webpush.setVapidDetails(opts.subject, opts.publicKey, opts.privateKey);
      this.enabledFlag = true;
    } else {
      this.enabledFlag = false;
    }
    this.breaker = new CircuitBreaker({
      name: 'notification-worker:web-push',
      failureThreshold: 5,
      openMs: 30_000,
      clock: SYSTEM_CLOCK,
    });
  }

  get enabled(): boolean {
    return this.enabledFlag;
  }

  async send(vars: NotificationVars, logger: AppLogger): Promise<boolean> {
    if (!this.enabledFlag) return false;

    const subscriptionJson = strOrUndef(vars.subscriptionJson);
    const title = strOrUndef(vars.title) ?? strOrUndef(vars.subject) ?? 'Notification';
    const body = strOrUndef(vars.body) ?? strOrUndef(vars.text) ?? '';

    if (!subscriptionJson) {
      throw new Error('push payload missing required field: subscriptionJson');
    }

    let subscription: PushSubscription;
    try {
      subscription = JSON.parse(subscriptionJson) as PushSubscription;
    } catch (err) {
      throw new Error(`push subscriptionJson invalid: ${(err as Error).message}`);
    }

    const payload = JSON.stringify({
      title,
      body,
      url: strOrUndef(vars.url),
    });

    try {
      await this.breaker.exec(async () => webpush.sendNotification(subscription, payload));
      logger.info({ endpoint: subscription.endpoint }, 'push sent');
      return true;
    } catch (err) {
      const status = (err as WebPushError | undefined)?.statusCode;
      if (status === 404 || status === 410) {
        // Subscription is gone — treat as terminal success so BullMQ
        // doesn't keep retrying a tombstoned endpoint. The producer
        // should observe this via a separate cleanup path.
        logger.warn(
          { endpoint: subscription.endpoint, status },
          'push subscription expired — acking',
        );
        return true;
      }
      throw err;
    }
  }
}

function strOrUndef(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
