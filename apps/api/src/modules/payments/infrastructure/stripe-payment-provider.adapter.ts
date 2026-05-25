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
import { CLOCK, type Clock } from '@app/clock';
import { CircuitBreaker, callExternal } from '@app/resilience';
import {
  WebhookSignatureError,
  type CheckoutSessionRequest,
  type CheckoutSessionResult,
  type PaymentProviderPort,
  type WebhookEvent,
} from '../application/ports/payment-provider.port';

@Injectable()
export class StripePaymentProvider implements PaymentProviderPort {
  private readonly client: InstanceType<typeof Stripe>;
  private readonly priceId: string;
  private readonly webhookSecret: string;
  private readonly logger: AppLogger = createLogger('payments.stripe');
  private readonly breaker: CircuitBreaker;

  constructor(
    @Inject(ConfigService) config: ConfigService<Env, true>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    // [O1] 4 fails / 60s. Stripe outages are rare but expensive
    // when they happen — every checkout 5xx is a lost conversion.
    // The breaker lets us 503 fast + retry the checkout button.
    this.breaker = new CircuitBreaker({
      name: 'stripe',
      clock,
      failureThreshold: 4,
      openMs: 60_000,
      onTransition: (from, to, name) =>
        this.logger.warn({ from, to, name }, 'circuit_state_change'),
    });
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
      // shift behaviour. Bumps land in a deliberate PR. Tracking the
      // SDK's pinned latest so the type system catches a mismatch
      // before the wire shape does.
      apiVersion: '2026-04-22.dahlia',
      typescript: true,
    });
    this.priceId = priceId;
    this.webhookSecret = webhookSecret;
  }

  async createCheckoutSession(req: CheckoutSessionRequest): Promise<CheckoutSessionResult> {
    const startedAt = this.clock.nowMs();
    const session = await callExternal(
      () =>
        this.client.checkout.sessions.create({
          mode: 'subscription',
          line_items: [{ price: this.priceId, quantity: 1 }],
          success_url: req.successUrl,
          cancel_url: req.cancelUrl,
          ...(req.stripeCustomerId
            ? { customer: req.stripeCustomerId }
            : { customer_email: req.userEmail, customer_creation: 'always' }),
          client_reference_id: req.userId,
          subscription_data: { metadata: { internalUserId: req.userId } },
          allow_promotion_codes: true,
        }),
      { breaker: this.breaker, timeoutMs: 10_000, label: 'stripe.checkout.create' },
    );
    if (!session.url) {
      throw new Error('Stripe returned a session without a URL');
    }
    this.logger.info(
      {
        userId: req.userId,
        sessionId: session.id,
        latencyMs: this.clock.nowMs() - startedAt,
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
    const session = await callExternal(
      () =>
        this.client.billingPortal.sessions.create({
          customer: stripeCustomerId,
          return_url: returnUrl,
        }),
      { breaker: this.breaker, timeoutMs: 10_000, label: 'stripe.portal.create' },
    );
    return session.url;
  }
}
