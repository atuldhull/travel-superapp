/**
 * AE415 — pure helpers for the Vault checkout panel.
 *
 * Per docs/aether/02-surfaces.md §8 Vault: "tap any glyph to book;
 * checkout is an Aether-styled iframe". The real Stripe Checkout
 * embed (`STRIPE_PUBLISHABLE_KEY` + the redirect URL contract) lands
 * with the live booking target; AE415 ships the panel chrome + the
 * state machine + the Aether-style form so the click → confirm path
 * is wired end-to-end, just without an actual charge.
 *
 * Pure — no React, no DOM. The panel component reads these helpers
 * to render the title / total / button copy + run the simulated
 * submission timeline.
 */
import { formatMinorAmount, type VaultPriceLike } from './vault-glyphs';

/** Checkout panel lifecycle. Distinct from `GenieRecorderStatus` etc.
 *  so each surface can render independently. */
export type VaultCheckoutStatus =
  | 'idle' // no panel open
  | 'open' // panel mounted, form interactive
  | 'submitting' // simulated payment in flight
  | 'success' // simulated payment complete
  | 'error'; // form validation or network failure

/** Simulated payment delay (ms). Short enough not to bore, long enough
 *  that the user sees the "submitting" state. Replace with the real
 *  Stripe round-trip when AE415b ships. */
export const VAULT_CHECKOUT_SIMULATED_DELAY_MS = 1500;

/** Title shown at the top of the panel — the price's `label`. */
export function checkoutTitle(price: VaultPriceLike): string {
  return price.label;
}

/** Formatted total — `formatMinorAmount(amountMinor, currency)`
 *  delegated so AE415 stays consistent with AE407's amount formatter. */
export function checkoutTotal(price: VaultPriceLike): string {
  return formatMinorAmount(price.amountMinor, price.currency);
}

/** Pay-button copy per state. */
export function checkoutSubmitLabel(status: VaultCheckoutStatus): string {
  switch (status) {
    case 'idle':
    case 'open':
      return 'Pay with Aether';
    case 'submitting':
      return 'Processing…';
    case 'success':
      return 'Booked';
    case 'error':
      return 'Try again';
  }
}

/** Footer line per state — honest about the Stripe gap. */
export function checkoutFooterCopy(status: VaultCheckoutStatus): string {
  if (status === 'success')
    return 'Confirmation handoff lands once Stripe Checkout is wired (AE415b).';
  return 'Stripe Checkout iframe lands later — this is a Phase 2 scaffold.';
}

/** Aria-live announcer copy for the lifecycle. */
export function checkoutStatusLabel(status: VaultCheckoutStatus): string {
  switch (status) {
    case 'idle':
      return 'Checkout closed';
    case 'open':
      return 'Checkout open, ready for input';
    case 'submitting':
      return 'Submitting payment';
    case 'success':
      return 'Payment confirmed';
    case 'error':
      return 'Payment error';
  }
}

/** Minimum acceptable name length. */
export const CHECKOUT_NAME_MIN_LENGTH = 2;

/** Loose RFC-5322 email regex — sufficient for a UI gate; the real
 *  validation happens server-side via Stripe. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True when the name is non-empty + meets the minimum length. */
export function validateCheckoutName(name: string): boolean {
  if (typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length >= CHECKOUT_NAME_MIN_LENGTH;
}

/** True when the email matches the loose regex. */
export function validateCheckoutEmail(email: string): boolean {
  if (typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim());
}

/** True when the form is in a state where the Pay button should be
 *  enabled. Wraps the validators + the lifecycle gate. */
export function canSubmitCheckout(
  status: VaultCheckoutStatus,
  name: string,
  email: string,
): boolean {
  if (status === 'submitting' || status === 'success') return false;
  return validateCheckoutName(name) && validateCheckoutEmail(email);
}

/** Reason copy for the disabled button (sr-only announcer). */
export function checkoutDisabledReason(
  status: VaultCheckoutStatus,
  name: string,
  email: string,
): string | null {
  if (status === 'submitting') return 'Submission in flight';
  if (status === 'success') return 'Already booked';
  if (!validateCheckoutName(name)) return 'Name is too short';
  if (!validateCheckoutEmail(email)) return 'Email looks invalid';
  return null;
}
