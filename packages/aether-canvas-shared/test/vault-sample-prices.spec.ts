/**
 * AE500 â€” canvas-shared own behavioural spec for `vault-sample-prices`.
 *
 * Pins the AE414 Vault sample-price catalogue: structural shape of every
 * fixture (id + label + INR currency + integer minor amount + history),
 * deep-freeze guarantee, non-empty invariant, and the cached
 * SAMPLE_VAULT_MIN_AMOUNT + SAMPLE_VAULT_MAX_AMOUNT bracket over the
 * catalogue's amountMinor field.
 */
import { SAMPLE_VAULT_MAX_AMOUNT, SAMPLE_VAULT_MIN_AMOUNT, SAMPLE_VAULT_PRICES } from '../src';

describe('AE500 â€” SAMPLE_VAULT_PRICES shape', () => {
  it('exposes a non-empty array', () => {
    expect(Array.isArray(SAMPLE_VAULT_PRICES)).toBe(true);
    expect(SAMPLE_VAULT_PRICES.length).toBeGreaterThan(0);
  });
  it('is frozen so consumers cannot mutate the demo set in place', () => {
    expect(Object.isFrozen(SAMPLE_VAULT_PRICES)).toBe(true);
  });
  it('ships exactly the four AE414 demo entries', () => {
    expect(SAMPLE_VAULT_PRICES).toHaveLength(4);
  });
  it('every entry has a non-empty string id', () => {
    for (const p of SAMPLE_VAULT_PRICES) {
      expect(typeof p.id).toBe('string');
      expect(p.id.length).toBeGreaterThan(0);
    }
  });
  it('every entry has a non-empty string label', () => {
    for (const p of SAMPLE_VAULT_PRICES) {
      expect(typeof p.label).toBe('string');
      expect(p.label.length).toBeGreaterThan(0);
    }
  });
  it('every entry quotes amountMinor as a positive safe integer', () => {
    for (const p of SAMPLE_VAULT_PRICES) {
      expect(Number.isInteger(p.amountMinor)).toBe(true);
      expect(p.amountMinor).toBeGreaterThan(0);
      expect(Number.isSafeInteger(p.amountMinor)).toBe(true);
    }
  });
  it('every entry uses INR (the Phase 2 demo currency)', () => {
    for (const p of SAMPLE_VAULT_PRICES) {
      expect(p.currency).toBe('INR');
    }
  });
  it('every entry has a 7-day history of positive numbers', () => {
    for (const p of SAMPLE_VAULT_PRICES) {
      expect(Array.isArray(p.history)).toBe(true);
      expect(p.history).toHaveLength(7);
      for (const h of p.history ?? []) {
        expect(typeof h).toBe('number');
        expect(h).toBeGreaterThan(0);
      }
    }
  });
  it('every history ends at the entry amountMinor (newest-last invariant)', () => {
    for (const p of SAMPLE_VAULT_PRICES) {
      const hist = p.history ?? [];
      expect(hist[hist.length - 1]).toBe(p.amountMinor);
    }
  });
  it('ids are unique across the catalogue', () => {
    const ids = SAMPLE_VAULT_PRICES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('includes the Leh sky garden stay fixture', () => {
    const leh = SAMPLE_VAULT_PRICES.find((p) => p.id === 'leh-stay-7d');
    expect(leh).toBeDefined();
    expect(leh?.label).toMatch(/leh/i);
    expect(leh?.label).toMatch(/7 nights/i);
  });
  it('includes the Mumbai to Jaipur return flight fixture', () => {
    const jaipur = SAMPLE_VAULT_PRICES.find((p) => p.id === 'jaipur-flight');
    expect(jaipur).toBeDefined();
    expect(jaipur?.label).toMatch(/jaipur/i);
    expect(jaipur?.label).toMatch(/return/i);
  });
});

describe('AE500 â€” SAMPLE_VAULT_MIN_AMOUNT', () => {
  it('is a positive safe integer', () => {
    expect(Number.isInteger(SAMPLE_VAULT_MIN_AMOUNT)).toBe(true);
    expect(SAMPLE_VAULT_MIN_AMOUNT).toBeGreaterThan(0);
  });
  it('equals the smallest amountMinor across the catalogue', () => {
    const expected = Math.min(...SAMPLE_VAULT_PRICES.map((p) => p.amountMinor));
    expect(SAMPLE_VAULT_MIN_AMOUNT).toBe(expected);
  });
  it('is less-than-or-equal-to every entry amountMinor', () => {
    for (const p of SAMPLE_VAULT_PRICES) {
      expect(SAMPLE_VAULT_MIN_AMOUNT).toBeLessThanOrEqual(p.amountMinor);
    }
  });
});

describe('AE500 â€” SAMPLE_VAULT_MAX_AMOUNT', () => {
  it('is a positive safe integer', () => {
    expect(Number.isInteger(SAMPLE_VAULT_MAX_AMOUNT)).toBe(true);
    expect(SAMPLE_VAULT_MAX_AMOUNT).toBeGreaterThan(0);
  });
  it('equals the largest amountMinor across the catalogue', () => {
    const expected = Math.max(...SAMPLE_VAULT_PRICES.map((p) => p.amountMinor));
    expect(SAMPLE_VAULT_MAX_AMOUNT).toBe(expected);
  });
  it('is greater-than-or-equal-to every entry amountMinor', () => {
    for (const p of SAMPLE_VAULT_PRICES) {
      expect(SAMPLE_VAULT_MAX_AMOUNT).toBeGreaterThanOrEqual(p.amountMinor);
    }
  });
});

describe('AE500 â€” min/max bracket', () => {
  it('min is less-than-or-equal-to max (holds even on a one-entry catalogue)', () => {
    expect(SAMPLE_VAULT_MIN_AMOUNT).toBeLessThanOrEqual(SAMPLE_VAULT_MAX_AMOUNT);
  });
});
