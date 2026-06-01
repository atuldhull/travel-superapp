/** Vitest specs for AE415 Vault checkout helpers. */
import { describe, expect, it } from 'vitest';
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
} from '../../src/components/aether/phase2/vault-checkout';
import type { VaultPriceLike } from '../../src/components/aether/phase2/vault-glyphs';

const sample: VaultPriceLike = {
  id: 'leh-stay-7d',
  label: 'Leh — sky garden stay (7 nights)',
  amountMinor: 4_200_000,
  currency: 'INR',
};

describe('VAULT_CHECKOUT constants (pure)', () => {
  it('simulated delay is a noticeable but short window', () => {
    expect(VAULT_CHECKOUT_SIMULATED_DELAY_MS).toBeGreaterThan(500);
    expect(VAULT_CHECKOUT_SIMULATED_DELAY_MS).toBeLessThan(5_000);
  });
  it('CHECKOUT_NAME_MIN_LENGTH ≥ 2 to ignore initials', () => {
    expect(CHECKOUT_NAME_MIN_LENGTH).toBeGreaterThanOrEqual(2);
  });
});

describe('checkoutTitle + checkoutTotal (pure)', () => {
  it('title mirrors the price label', () => {
    expect(checkoutTitle(sample)).toBe(sample.label);
  });
  it('total is the formatted minor amount', () => {
    const total = checkoutTotal(sample);
    expect(total).toContain('42');
  });
});

describe('checkoutSubmitLabel (pure)', () => {
  const cases: Array<[VaultCheckoutStatus, string]> = [
    ['idle', 'Pay with Aether'],
    ['open', 'Pay with Aether'],
    ['submitting', 'Processing…'],
    ['success', 'Booked'],
    ['error', 'Try again'],
  ];
  for (const [status, label] of cases) {
    it(`${status} → "${label}"`, () => {
      expect(checkoutSubmitLabel(status)).toBe(label);
    });
  }
});

describe('checkoutFooterCopy (pure)', () => {
  it('non-success status calls out the Stripe gap', () => {
    expect(checkoutFooterCopy('open').toLowerCase()).toContain('stripe');
    expect(checkoutFooterCopy('open').toLowerCase()).toContain('later');
  });
  it('success status references the AE415b handoff', () => {
    expect(checkoutFooterCopy('success')).toContain('AE415b');
  });
});

describe('checkoutStatusLabel (pure)', () => {
  it('returns a non-empty label for every state', () => {
    const states: VaultCheckoutStatus[] = ['idle', 'open', 'submitting', 'success', 'error'];
    for (const s of states) {
      expect(checkoutStatusLabel(s).length).toBeGreaterThan(0);
    }
  });
});

describe('validateCheckoutName (pure)', () => {
  it('false for too-short or whitespace-only', () => {
    expect(validateCheckoutName('')).toBe(false);
    expect(validateCheckoutName('A')).toBe(false);
    expect(validateCheckoutName('   ')).toBe(false);
  });
  it('true for a real-looking name', () => {
    expect(validateCheckoutName('Asha')).toBe(true);
    expect(validateCheckoutName('  Asha  ')).toBe(true);
    expect(validateCheckoutName('Asha Verma')).toBe(true);
  });
  it('handles non-string inputs safely', () => {
    expect(validateCheckoutName(null as unknown as string)).toBe(false);
    expect(validateCheckoutName(undefined as unknown as string)).toBe(false);
  });
});

describe('validateCheckoutEmail (pure)', () => {
  it('accepts a regular email', () => {
    expect(validateCheckoutEmail('a@b.co')).toBe(true);
    expect(validateCheckoutEmail('asha.verma@aether.travel')).toBe(true);
  });
  it('rejects malformed addresses', () => {
    expect(validateCheckoutEmail('')).toBe(false);
    expect(validateCheckoutEmail('asha')).toBe(false);
    expect(validateCheckoutEmail('asha@')).toBe(false);
    expect(validateCheckoutEmail('asha@aether')).toBe(false);
    expect(validateCheckoutEmail('@aether.travel')).toBe(false);
    expect(validateCheckoutEmail('two spaces @aether.travel')).toBe(false);
  });
  it('trims surrounding whitespace before testing', () => {
    expect(validateCheckoutEmail('  asha@aether.travel  ')).toBe(true);
  });
  it('handles non-string inputs safely', () => {
    expect(validateCheckoutEmail(null as unknown as string)).toBe(false);
  });
});

describe('canSubmitCheckout (pure)', () => {
  it('true when form valid + status is open / idle / error', () => {
    expect(canSubmitCheckout('open', 'Asha', 'a@b.co')).toBe(true);
    expect(canSubmitCheckout('idle', 'Asha', 'a@b.co')).toBe(true);
    expect(canSubmitCheckout('error', 'Asha', 'a@b.co')).toBe(true);
  });
  it('false when submitting', () => {
    expect(canSubmitCheckout('submitting', 'Asha', 'a@b.co')).toBe(false);
  });
  it('false once already succeeded (no double charge)', () => {
    expect(canSubmitCheckout('success', 'Asha', 'a@b.co')).toBe(false);
  });
  it('false with bad inputs', () => {
    expect(canSubmitCheckout('open', 'A', 'a@b.co')).toBe(false);
    expect(canSubmitCheckout('open', 'Asha', 'no-at')).toBe(false);
  });
});

describe('checkoutDisabledReason (pure)', () => {
  it('lifecycle gates take priority', () => {
    expect(checkoutDisabledReason('submitting', 'Asha', 'a@b.co')).toBe('Submission in flight');
    expect(checkoutDisabledReason('success', 'Asha', 'a@b.co')).toBe('Already booked');
  });
  it('flags name length first', () => {
    expect(checkoutDisabledReason('open', '', 'a@b.co')).toBe('Name is too short');
  });
  it('flags email format once name is valid', () => {
    expect(checkoutDisabledReason('open', 'Asha', 'nope')).toBe('Email looks invalid');
  });
  it('returns null when there is nothing to flag', () => {
    expect(checkoutDisabledReason('open', 'Asha', 'a@b.co')).toBeNull();
  });
});
