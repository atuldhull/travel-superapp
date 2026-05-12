/**
 * Port: payment provider (Stripe today, swappable later).
 *
 * Three responsibilities live here:
 *   - `createCheckoutSession` — server-creates a hosted-checkout
 *     session for the Premium tier and returns the redirect URL.
 *   - `verifyWebhook` — verifies the `Stripe-Signature` header
 *     against the raw request bytes + the webhook secret. Throws
 *     `WebhookSignatureError` (DomainError) if the signature
 *     doesn't match. Returns the parsed event on success.
 *   - `getCustomerPortalUrl` — returns the URL the user clicks on
 *     `/account/billing` to manage their subscription via Stripe's
 *     hosted Customer Portal.
 *
 * Single adapter today:
 *   - `StripePaymentProvider` — wraps the official `stripe` SDK.
 *     Constructed only when `STRIPE_SECRET_KEY` is present (see
 *     PaymentsModule's env-gated factory).
 *
 * Installed by prompt [POST.9].
 */
import { DomainError } from '@app/errors';

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

/** Thrown when Stripe's webhook-signature verification fails.
 *  Maps to 400 BAD_REQUEST so a misconfigured / replayed webhook
 *  doesn't accidentally write to our DB. */
export class WebhookSignatureError extends DomainError {
  public readonly code = 'WEBHOOK_SIGNATURE_INVALID';
  public readonly httpStatus = 400;
  constructor(message: string, providerError?: string) {
    super(message, providerError !== undefined ? { providerError } : {});
  }
}

export interface CheckoutSessionRequest {
  readonly userId: string;
  readonly userEmail: string;
  /** Optional Stripe Customer id — when the user already has a
   *  Subscription row from a previous purchase, we re-use the
   *  existing customer instead of creating a duplicate. */
  readonly stripeCustomerId?: string;
  /** URL Stripe redirects to after successful checkout. Must
   *  include `{CHECKOUT_SESSION_ID}` so we can fetch the session
   *  details on landing if needed. */
  readonly successUrl: string;
  /** URL Stripe redirects to if the user cancels checkout. */
  readonly cancelUrl: string;
}

export interface CheckoutSessionResult {
  readonly sessionId: string;
  /** Stripe-hosted checkout URL — the client redirects the browser here. */
  readonly url: string;
}

export interface WebhookEvent {
  readonly id: string;
  readonly type: string;
  /** Pass-through of Stripe's `data.object` — the webhook handler
   *  narrows by `type` and casts as needed. */
  readonly dataObject: Record<string, unknown>;
}

export interface PaymentProviderPort {
  createCheckoutSession(req: CheckoutSessionRequest): Promise<CheckoutSessionResult>;
  /**
   * Throws `WebhookSignatureError` when the signature header doesn't
   * verify against the raw body + webhook secret. Returns the parsed
   * event on success.
   */
  verifyWebhook(rawBody: Buffer, signatureHeader: string): WebhookEvent;
  /**
   * Returns a URL to Stripe's hosted Customer Portal for the given
   * customer. The caller renders this as a "Manage subscription"
   * link on /account/billing.
   */
  getCustomerPortalUrl(stripeCustomerId: string, returnUrl: string): Promise<string>;
}
