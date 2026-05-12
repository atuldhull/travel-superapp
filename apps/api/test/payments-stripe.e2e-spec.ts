/**
 * POST.9 — Stripe payments smoke tests.
 *
 * Skipped when STRIPE_SECRET_KEY is absent (dev / CI without Stripe
 * TEST credentials). When the key IS set, makes real calls against
 * Stripe TEST mode — no real money moves, no real charges land.
 *
 * Six tests covering:
 *   1. Construction with all 3 env vars succeeds
 *   2. Missing webhook secret throws at construction
 *   3. Missing price id throws at construction
 *   4. createCheckoutSession returns a session id + redirect URL
 *   5. verifyWebhook accepts a Stripe-signed payload (round-trip)
 *   6. verifyWebhook rejects an invalid signature (WebhookSignatureError)
 *
 * Run locally:
 *   STRIPE_SECRET_KEY=sk_test_… STRIPE_WEBHOOK_SECRET=whsec_test \
 *   STRIPE_PRICE_PREMIUM=price_… \
 *     pnpm --filter=api test payments-stripe
 */
import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import {
  WebhookSignatureError,
  type PaymentProviderPort,
} from '../src/modules/payments/application/ports/payment-provider.port';
import { StripePaymentProvider } from '../src/modules/payments/infrastructure/stripe-payment-provider.adapter';

const skip = !process.env['STRIPE_SECRET_KEY'];
const describeReal = skip ? describe.skip : describe;

describeReal('POST.9 — StripePaymentProvider (integration, requires STRIPE_SECRET_KEY)', () => {
  function makeConfig(
    overrides: Record<string, string | undefined> = {},
  ): ConfigService<Record<string, unknown>, true> {
    const fake = {
      STRIPE_SECRET_KEY: process.env['STRIPE_SECRET_KEY'] ?? '',
      STRIPE_WEBHOOK_SECRET: process.env['STRIPE_WEBHOOK_SECRET'] ?? 'whsec_test_dummy',
      STRIPE_PRICE_PREMIUM: process.env['STRIPE_PRICE_PREMIUM'] ?? '',
      ...overrides,
    };
    return {
      get: (key: string) => fake[key as keyof typeof fake],
    } as unknown as ConfigService<Record<string, unknown>, true>;
  }

  it('constructs cleanly with all 3 env vars', () => {
    if (!process.env['STRIPE_PRICE_PREMIUM']) {
      // Need a real price id for this branch; otherwise constructor will
      // throw. Skip silently if not provided.
      return;
    }
    const provider = new StripePaymentProvider(makeConfig());
    expect(provider).toBeInstanceOf(StripePaymentProvider);
  });

  it('throws when STRIPE_WEBHOOK_SECRET is absent', () => {
    expect(
      () => new StripePaymentProvider(makeConfig({ STRIPE_WEBHOOK_SECRET: undefined })),
    ).toThrow(/STRIPE_WEBHOOK_SECRET/);
  });

  it('throws when STRIPE_PRICE_PREMIUM is absent', () => {
    expect(
      () => new StripePaymentProvider(makeConfig({ STRIPE_PRICE_PREMIUM: undefined })),
    ).toThrow(/STRIPE_PRICE_PREMIUM/);
  });

  it('createCheckoutSession returns a session id + Stripe-hosted URL', async () => {
    if (!process.env['STRIPE_PRICE_PREMIUM']) return; // need real price id
    const provider = new StripePaymentProvider(makeConfig());
    const result = await provider.createCheckoutSession({
      userId: 'test-user-id',
      userEmail: 'test+post9@example.com',
      successUrl: 'http://localhost:3002/account/billing?session={CHECKOUT_SESSION_ID}',
      cancelUrl: 'http://localhost:3002/pricing',
    });
    expect(result.sessionId).toMatch(/^cs_test_/);
    expect(result.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
  }, 30_000);

  /** Signs a Stripe webhook payload exactly the way Stripe does
   *  (`t=…,v1=…` in the `Stripe-Signature` header). Used by the
   *  positive verifyWebhook test. */
  function signStripePayload(payload: string, secret: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;
    const sig = createHmac('sha256', secret).update(signedPayload).digest('hex');
    return `t=${timestamp},v1=${sig}`;
  }

  it('verifyWebhook accepts a valid Stripe signature', () => {
    // Use a dummy webhook secret so we can sign + verify locally
    // without hitting Stripe.
    const provider: PaymentProviderPort = new StripePaymentProvider(
      makeConfig({
        STRIPE_WEBHOOK_SECRET: 'whsec_test_dummy_secret_for_signing',
        STRIPE_PRICE_PREMIUM: process.env['STRIPE_PRICE_PREMIUM'] ?? 'price_dummy',
      }),
    );
    if (!process.env['STRIPE_PRICE_PREMIUM']) return; // need real price for ctor
    const body = JSON.stringify({
      id: 'evt_test_123',
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_test_123' } },
    });
    const header = signStripePayload(body, 'whsec_test_dummy_secret_for_signing');
    const event = provider.verifyWebhook(Buffer.from(body, 'utf8'), header);
    expect(event.id).toBe('evt_test_123');
    expect(event.type).toBe('customer.subscription.updated');
  });

  it('verifyWebhook rejects an invalid signature with WebhookSignatureError', () => {
    if (!process.env['STRIPE_PRICE_PREMIUM']) return; // need real price for ctor
    const provider: PaymentProviderPort = new StripePaymentProvider(
      makeConfig({
        STRIPE_WEBHOOK_SECRET: 'whsec_real',
        STRIPE_PRICE_PREMIUM: process.env['STRIPE_PRICE_PREMIUM'],
      }),
    );
    const body = JSON.stringify({ id: 'evt_test_999', type: 'fake' });
    expect(() => provider.verifyWebhook(Buffer.from(body, 'utf8'), 't=1,v1=deadbeef')).toThrow(
      WebhookSignatureError,
    );
  });
});
