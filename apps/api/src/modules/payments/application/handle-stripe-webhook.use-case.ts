/**
 * POST.9 — Stripe webhook entry point. Verifies the signature, then
 * dispatches by event type. Today we handle:
 *
 *   - `checkout.session.completed` → fetch subscription details + sync
 *   - `customer.subscription.created` → sync
 *   - `customer.subscription.updated` → sync (handles plan changes,
 *     cancel-at-period-end toggles, payment failures via status flip)
 *   - `customer.subscription.deleted` → sync (status='canceled')
 *
 * Anything else is logged + ignored — Stripe retries unrecognised
 * events less aggressively, and the audit trail in our logs makes it
 * obvious if we ever need to wire a new event type.
 *
 * Idempotency is delegated to SyncSubscriptionUseCase, which upserts
 * by `stripeSubscriptionId @unique` — a duplicate webhook produces
 * the same DB state.
 *
 * Installed by prompt [POST.9].
 */
import { Inject, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { createLogger, type AppLogger } from '@app/logger';
import { PAYMENT_PROVIDER, type PaymentProviderPort } from './ports/payment-provider.port';
import {
  SyncSubscriptionUseCase,
  type StripeSubscriptionStatus,
} from './sync-subscription.use-case';

@Injectable()
export class HandleStripeWebhookUseCase {
  private readonly logger: AppLogger = createLogger('payments.webhook');

  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProviderPort,
    private readonly sync: SyncSubscriptionUseCase,
  ) {}

  /** Verifies signature → throws WebhookSignatureError on mismatch
   *  (controller maps to 400). Returns the event id for the response
   *  body (handy for log-correlating from Stripe's dashboard). */
  async execute(rawBody: Buffer, signatureHeader: string): Promise<{ readonly eventId: string }> {
    const event = this.payments.verifyWebhook(rawBody, signatureHeader);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutSessionCompleted(event.dataObject);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.onSubscription(event.dataObject);
        break;
      default:
        this.logger.info({ eventId: event.id, type: event.type }, 'webhook_ignored_unhandled_type');
    }
    return { eventId: event.id };
  }

  private async onCheckoutSessionCompleted(data: Record<string, unknown>): Promise<void> {
    const session = data as unknown as Stripe.Checkout.Session;
    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id;
    const internalUserId = session.client_reference_id ?? session.metadata?.['internalUserId'];

    if (!subscriptionId || !customerId || !internalUserId) {
      this.logger.warn(
        { sessionId: session.id, subscriptionId, customerId, internalUserId },
        'webhook_checkout_missing_fields',
      );
      return;
    }
    // The Checkout session itself doesn't carry the full subscription
    // shape (status, period_end, etc). Synthesise a 'trialing'/'active'
    // sync from what we DO have; the follow-up customer.subscription.*
    // events refine it within seconds.
    await this.sync.execute({
      internalUserId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      status: 'active',
      priceCents: session.amount_total ?? 0,
      currency: (session.currency ?? 'usd').toUpperCase(),
      // 30-day placeholder — overwritten by the next subscription.updated event.
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
    });
  }

  private async onSubscription(data: Record<string, unknown>): Promise<void> {
    const sub = data as unknown as Stripe.Subscription;
    const internalUserId = sub.metadata?.['internalUserId'];
    if (!internalUserId) {
      this.logger.warn({ subscriptionId: sub.id }, 'webhook_subscription_missing_internal_user_id');
      return;
    }
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const item = sub.items.data[0];
    const priceCents = item?.price?.unit_amount ?? 0;
    const currency = (item?.price?.currency ?? 'usd').toUpperCase();
    // Stripe.Subscription has `current_period_end` on each item in
    // 2025+ API versions. Fall back to the legacy top-level field
    // for older event payloads.
    const periodEndSec =
      item?.current_period_end ??
      (sub as unknown as { current_period_end?: number }).current_period_end ??
      0;
    await this.sync.execute({
      internalUserId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      status: sub.status as StripeSubscriptionStatus,
      priceCents,
      currency,
      currentPeriodEnd: new Date(periodEndSec * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    });
  }
}
