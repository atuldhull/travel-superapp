/**
 * POST.9 — Payments module (Stripe scaffold for the Premium tier).
 *
 *   controller (interface)
 *     → CreateCheckoutSession / HandleStripeWebhook (application)
 *       → PAYMENT_PROVIDER (port)
 *         ← StripePaymentProvider (infrastructure) — wired ONLY when
 *           STRIPE_SECRET_KEY is set
 *
 * The factory mirrors the env-gated pattern from POST.3
 * (ResendMailerAdapter) and POST.4 (multi-provider AI). When
 * STRIPE_SECRET_KEY is absent the factory returns `null` for the
 * port; the controller short-circuits with 503 PAYMENTS_DISABLED.
 *
 * StripePaymentProvider is intentionally NOT in providers[] — its
 * ctor throws when env vars are missing and Nest would eagerly
 * instantiate it.
 *
 * Installed by prompt [POST.9].
 */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@app/config';
import { CreateCheckoutSessionUseCase } from './application/create-checkout-session.use-case';
import { HandleStripeWebhookUseCase } from './application/handle-stripe-webhook.use-case';
import { PAYMENT_PROVIDER } from './application/ports/payment-provider.port';
import { SyncSubscriptionUseCase } from './application/sync-subscription.use-case';
import { StripePaymentProvider } from './infrastructure/stripe-payment-provider.adapter';
import { PaymentsController } from './interface/payments.controller';

@Module({
  controllers: [PaymentsController],
  providers: [
    CreateCheckoutSessionUseCase,
    SyncSubscriptionUseCase,
    HandleStripeWebhookUseCase,
    {
      // POST.9 — env-gated factory. Returns the real Stripe adapter
      // when STRIPE_SECRET_KEY is set; returns `null` otherwise so
      // the controller can 503 cleanly. The Stripe ctor reads the
      // other 2 env vars (price + webhook secret) and throws if
      // either is missing — surfaces misconfig early.
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const apiKey = config.get('STRIPE_SECRET_KEY', { infer: true });
        if (!apiKey) return null;
        return new StripePaymentProvider(config);
      },
    },
  ],
})
export class PaymentsModule {}
