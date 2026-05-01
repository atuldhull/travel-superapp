/**
 * Port for stored Web Push subscriptions. v1 surface:
 *
 *   - `upsertByEndpoint`  — caller-id stamps the row; same endpoint
 *                           re-subscribed by a different user takes
 *                           ownership (browser endpoints are tied to
 *                           the install, not the account).
 *   - `listForUser`       — the dispatcher fan-out reads this to find
 *                           all subscriptions belonging to a recipient.
 *   - `deleteByEndpoint`  — owner-scoped unsubscribe + 410-Gone cleanup.
 *
 * Installed by prompt [V.UX.26].
 */
import type { PushSubscription } from '../../domain/push-subscription.entity';

export interface UpsertPushSubscriptionInput {
  readonly userId: string;
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
}

export interface PushSubscriptionRepository {
  upsertByEndpoint(input: UpsertPushSubscriptionInput): Promise<PushSubscription>;
  listForUser(userId: string): Promise<readonly PushSubscription[]>;
  deleteByEndpoint(userId: string, endpoint: string): Promise<boolean>;
  /** Used by the dispatcher when a delivery returns 404 / 410 — the
   *  endpoint is dead and must be reaped to stop wasting fan-outs. */
  deleteExpiredEndpoint(endpoint: string): Promise<void>;
}

export const PUSH_SUBSCRIPTION_REPOSITORY = Symbol('PushSubscriptionRepository');
