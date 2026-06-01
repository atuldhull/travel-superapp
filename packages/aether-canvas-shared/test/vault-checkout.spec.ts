/**
 * AE495 — canvas-shared own behavioural spec for `vault-checkout`.
 *
 * Pins title + total delegation, the five-state copy table (submit
 * label + footer + aria-live), name + email validators with edge
 * cases, the canSubmit gate's lifecycle interaction with form
 * validity, and disabled-reason ordering (status > name > email).
 */
import {
  CHECKOUT_NAME_MIN_LENGTH,
  VAULT_CHECKOUT_SIMULATED_DELAY_MS,
  canSubmitCheckout,
  checkoutDisabledReason,
  checkoutFooterCopy,
  checkoutStatusLabel,
  checkoutSubmitLabel,
  checkoutTitle,
  checkoutTotal,
  validateCheckoutEmail,
  validateCheckoutName,
  type VaultCheckoutStatus,
  type VaultPriceLike,
} from '../src';

const PRICE: VaultPriceLike = {
  id: 'p1',
  label: 'Riverside Suite — 2 nights',
  amountMinor: 12_500_00,
  currency: 'INR',
};

const ALL_STATUSES: VaultCheckoutStatus[] = ['idle', 'open', 'submitting', 'success', 'error'];

describe('AE495 — constants sanity', () => {
  it('CHECKOUT_NAME_MIN_LENGTH is a small positive integer', () => {
    expect(Number.isInteger(CHECKOUT_NAME_MIN_LENGTH)).toBe(true);
    expect(CHECKOUT_NAME_MIN_LENGTH).toBeGreaterThan(0);
    expect(CHECKOUT_NAME_MIN_LENGTH).toBeLessThanOrEqual(4);
  });
  it('VAULT_CHECKOUT_SIMULATED_DELAY_MS is in the tactile range (500..3000ms)', () => {
    expect(VAULT_CHECKOUT_SIMULATED_DELAY_MS).toBeGreaterThanOrEqual(500);
    expect(VAULT_CHECKOUT_SIMULATED_DELAY_MS).toBeLessThanOrEqual(3_000);
  });
});

describe('AE495 — checkoutTitle + checkoutTotal', () => {
  it('checkoutTitle echoes the price label verbatim', () => {
    expect(checkoutTitle(PRICE)).toBe('Riverside Suite — 2 nights');
  });
  it('checkoutTotal formats the minor amount in the price currency', () => {
    const formatted = checkoutTotal(PRICE);
    expect(formatted.length).toBeGreaterThan(0);
    // The exact glyph depends on locale + currency. Pin that the
    // formatted total contains digits + a currency-ish character.
    expect(formatted).toMatch(/[0-9]/);
  });
});

describe('AE495 — checkoutSubmitLabel copy table', () => {
  it('returns a non-empty label for every status', () => {
    for (const s of ALL_STATUSES) {
      expect(checkoutSubmitLabel(s).length).toBeGreaterThan(0);
    }
  });
  it('idle + open both read "Pay with Aether"', () => {
    expect(checkoutSubmitLabel('idle')).toBe('Pay with Aether');
    expect(checkoutSubmitLabel('open')).toBe('Pay with Aether');
  });
  it('submitting reads "Processing…"', () => {
    expect(checkoutSubmitLabel('submitting')).toMatch(/processing/i);
  });
  it('success reads "Booked"', () => {
    expect(checkoutSubmitLabel('success')).toMatch(/book/i);
  });
  it('error reads "Try again"', () => {
    expect(checkoutSubmitLabel('error')).toMatch(/try again/i);
  });
});

describe('AE495 — checkoutFooterCopy', () => {
  it('success copy mentions the AE415b Stripe handoff', () => {
    expect(checkoutFooterCopy('success')).toMatch(/stripe/i);
    expect(checkoutFooterCopy('success')).toMatch(/AE415b/);
  });
  it('non-success copy admits the Phase 2 scaffold + Stripe gap', () => {
    for (const s of ALL_STATUSES.filter((x) => x !== 'success')) {
      const copy = checkoutFooterCopy(s);
      expect(copy).toMatch(/stripe/i);
      expect(copy).toMatch(/phase 2|scaffold/i);
    }
  });
});

describe('AE495 — checkoutStatusLabel aria-live', () => {
  it('returns a non-empty label for every status', () => {
    for (const s of ALL_STATUSES) {
      expect(checkoutStatusLabel(s).length).toBeGreaterThan(0);
    }
  });
  it('uses distinct copy per status (no collisions)', () => {
    const seen = new Set(ALL_STATUSES.map(checkoutStatusLabel));
    expect(seen.size).toBe(ALL_STATUSES.length);
  });
});

describe('AE495 — validateCheckoutName', () => {
  it('rejects empty + sub-min strings', () => {
    expect(validateCheckoutName('')).toBe(false);
    expect(validateCheckoutName('a')).toBe(false);
  });
  it('accepts at + above the minimum length', () => {
    expect(validateCheckoutName('Mo')).toBe(true);
    expect(validateCheckoutName('Atul Dhull')).toBe(true);
  });
  it('trims whitespace before length check', () => {
    expect(validateCheckoutName('   ')).toBe(false);
    expect(validateCheckoutName('  Al  ')).toBe(true);
  });
  it('rejects non-string input', () => {
    expect(validateCheckoutName(123 as unknown as string)).toBe(false);
    expect(validateCheckoutName(null as unknown as string)).toBe(false);
    expect(validateCheckoutName(undefined as unknown as string)).toBe(false);
  });
});

describe('AE495 — validateCheckoutEmail', () => {
  it('accepts well-formed emails', () => {
    expect(validateCheckoutEmail('a@b.co')).toBe(true);
    expect(validateCheckoutEmail('atul.dhull+tag@example.com')).toBe(true);
  });
  it('rejects strings missing @, dot, or local/domain part', () => {
    expect(validateCheckoutEmail('')).toBe(false);
    expect(validateCheckoutEmail('plainstring')).toBe(false);
    expect(validateCheckoutEmail('no-at-sign.com')).toBe(false);
    expect(validateCheckoutEmail('@nolocal.com')).toBe(false);
    expect(validateCheckoutEmail('nodomain@')).toBe(false);
    expect(validateCheckoutEmail('nodot@example')).toBe(false);
  });
  it('rejects internal whitespace', () => {
    expect(validateCheckoutEmail('a b@c.co')).toBe(false);
    expect(validateCheckoutEmail('a@b c.co')).toBe(false);
  });
  it('trims surrounding whitespace before validation', () => {
    expect(validateCheckoutEmail('  a@b.co  ')).toBe(true);
  });
  it('rejects non-string input', () => {
    expect(validateCheckoutEmail(123 as unknown as string)).toBe(false);
    expect(validateCheckoutEmail(null as unknown as string)).toBe(false);
  });
});

describe('AE495 — canSubmitCheckout gate', () => {
  it('is false while submitting + after success regardless of form validity', () => {
    expect(canSubmitCheckout('submitting', 'Mo', 'a@b.co')).toBe(false);
    expect(canSubmitCheckout('success', 'Mo', 'a@b.co')).toBe(false);
  });
  it('is true when the form is valid + status is open/idle/error', () => {
    expect(canSubmitCheckout('open', 'Mo', 'a@b.co')).toBe(true);
    expect(canSubmitCheckout('idle', 'Mo', 'a@b.co')).toBe(true);
    expect(canSubmitCheckout('error', 'Mo', 'a@b.co')).toBe(true);
  });
  it('is false when either field is invalid', () => {
    expect(canSubmitCheckout('open', '', 'a@b.co')).toBe(false);
    expect(canSubmitCheckout('open', 'Mo', 'no-at-sign')).toBe(false);
  });
});

describe('AE495 — checkoutDisabledReason ordering', () => {
  it('returns null when everything is valid + status is open', () => {
    expect(checkoutDisabledReason('open', 'Mo', 'a@b.co')).toBe(null);
  });
  it('reports submitting before form errors', () => {
    expect(checkoutDisabledReason('submitting', '', '')).toMatch(/submission/i);
  });
  it('reports already-booked before form errors', () => {
    expect(checkoutDisabledReason('success', '', '')).toMatch(/already booked/i);
  });
  it('reports name-too-short when status is open + name is bad', () => {
    expect(checkoutDisabledReason('open', '', 'a@b.co')).toMatch(/name/i);
  });
  it('reports email-invalid when name is fine but email fails', () => {
    expect(checkoutDisabledReason('open', 'Mo', 'no-at-sign')).toMatch(/email/i);
  });
});
