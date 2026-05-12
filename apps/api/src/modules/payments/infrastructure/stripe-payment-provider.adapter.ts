/**
 * Stripe adapter for the PaymentProviderPort. Wraps the official
 * `stripe` SDK. Activated by the PaymentsModule factory only when
 * `STRIPE_SECRET_KEY` is set — when absent, the factory returns a
 * stub that 503s the checkout route + no-ops the webhook handler.
 *
 * Behaviour:
 *   - `createCheckoutSession` issues a recurring-mode subscription
 *     checkout for `STRIPE_PRICE_PREMIUM`. Reuses the caller's
 *     existing `stripeCustomerId` when present so we never end up
 *     with multiple Stripe Customer rows for the same user.
 *   - `verifyWebhook` uses the SDK's `webhooks.constructEvent` —
 *     the cleanest path to constant-time signature verify against
 *     the secret.
 *   - `getCustomerPortalUrl` mints a one-time portal URL — Stripe
 *     handles cancel / payment-method-update / receipt-download
 *     itself, no UI to build on our side.
 *
 * Installed by prompt [POST.9].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type { Env } from '@app/config';
import { createLogger, type AppLogger } from '@app/logger';
import {
  WebhookSignatureError,
  type CheckoutSessionRequest,
  type CheckoutSessionResult,
  type PaymentProviderPort,
  type WebhookEvent,
} from '../application/ports/payment-provider.port';

@Injectable()
export class StripePaymentProvider implements PaymentProviderPort {
  private readonly client: Stripe;
  private readonly priceId: string;
  private readonly webhookSecret: string;
  private readonly logger: AppLogger = createLogger('payments.stripe');

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    const apiKey = config.get('STRIPE_SECRET_KEY', { infer: true });
    if (!apiKey) {
      // Should never happen — the PaymentsModule factory only
      // instantiates this adapter when the key is set.
      throw new Error('StripePaymentProvider requires STRIPE_SECRET_KEY env var');
    }
    const priceId = config.get('STRIPE_PRICE_PREMIUM', { infer: true });
    if (!priceId) {
      throw new Error('StripePaymentProvider requires STRIPE_PRICE_PREMIUM (recurring price id)');
    }
    const webhookSecret = config.get('STRIPE_WEBHOOK_SECRET', { infer: true });
    if (!webhookSecret) {
      throw new Error('StripePaymentProvider requires STRIPE_WEBHOOK_SECRET env var');
    }
    this.client = new Stripe(apiKey, {
      // Pin the API version so a Stripe-side change can't silently
      // shift behaviour. Bumps land in a deliberate PR.
      apiVersion: '2025-09-30.clover',
      typescript: true,
    });
    this.priceId = priceId;
    this.webhookSecret = webhookSecret;
  }

  async createCheckoutSession(req: CheckoutSessionRequest): Promise<CheckoutSessionResult> {
    const startedAt = Date.now();
    const session = await this.client.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: this.priceId, quantity: 1 }],
      success_url: req.successUrl,
      cancel_url: req.cancelUrl,
      // Re-use the existing Stripe Customer when the user already has
      // a Subscription. Otherwise let Stripe create one keyed by
      // customer_email so we don't end up with duplicates if the user
      // returns later from a different device.
      ...(req.stripeCustomerId
        ? { customer: req.stripeCustomerId }
        : { customer_email: req.userEmail, customer_creation: 'always' }),
      // Stash our internal user id on both the session AND the
      // resulting Subscription so the webhook handler can map back
      // without an extra lookup.
      client_reference_id: req.userId,
      subscription_data: {
        metadata: { internalUserId: req.userId },
      },
      // Allow promotion codes since we'll likely run launch promos.
      allow_promotion_codes: true,
    });
    if (!session.url) {
      throw new Error('Stripe returned a session without a URL');
    }
    this.logger.info(
      {
        userId: req.userId,
        sessionId: session.id,
        latencyMs: Date.now() - startedAt,
      },
      'stripe_checkout_session_created',
    );
    return { sessionId: session.id, url: session.url };
  }

  verifyWebhook(rawBody: Buffer, signatureHeader: string): WebhookEvent {
    try {
      const event = this.client.webhooks.constructEvent(
        rawBody,
        signatureHeader,
        this.webhookSecret,
      );
      return {
        id: event.id,
        type: event.type,
        dataObject: event.data.object as unknown as Record<string, unknown>,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn({ err: msg }, 'stripe_webhook_signature_failed');
      throw new WebhookSignatureError('Stripe webhook signature did not verify', msg);
    }
  }

  async getCustomerPortalUrl(stripeCustomerId: string, returnUrl: string): Promise<string> {
    const session = await this.client.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });
    return session.url;
  }
}
