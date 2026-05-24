/**
 * Smoke tests for the [I1] test factories. Locks the
 * deterministic-uniqueness + payload-shape contract — every
 * downstream e2e suite depends on it.
 */
import {
  TEST_DOMAIN,
  TEST_PASSWORD,
  uniqueEmail,
  uniqueId,
  uniqueName,
  uniqueSuffix,
} from './factories';
import { makeTripPayload } from './factories/trips';
import { makeExpensePayload } from './factories/expenses';
import { extractRefreshCookie } from './factories/users';

describe('test factories — unique-id helpers', () => {
  it('uniqueSuffix returns 8-char hex slugs', () => {
    const a = uniqueSuffix();
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });

  it('uniqueSuffix is collision-free across 10 000 calls (smoke)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) seen.add(uniqueSuffix());
    expect(seen.size).toBe(10_000);
  });

  it('uniqueEmail composes prefix + suffix + domain', () => {
    const email = uniqueEmail('my-suite');
    expect(email).toMatch(new RegExp(`^my-suite-[0-9a-f]{8}@${TEST_DOMAIN}$`));
  });

  it('uniqueName has no domain', () => {
    expect(uniqueName('my-suite')).toMatch(/^my-suite-[0-9a-f]{8}$/);
  });

  it('uniqueId prefixes the kind tag', () => {
    expect(uniqueId('scam')).toMatch(/^scam-[0-9a-f]{24}$/);
  });

  it('TEST_PASSWORD is the canonical placeholder', () => {
    expect(TEST_PASSWORD).toBe('correct-horse-battery-staple');
  });
});

describe('test factories — trip payload', () => {
  it('default payload is valid (matches trip create DTO contract)', () => {
    const p = makeTripPayload({ prefix: 'unit' });
    expect(p.title).toMatch(/^unit-[0-9a-f]{8}$/);
    expect(p.destination).toMatch(/^dest-[0-9a-f]{8}$/);
    expect(p.radiusKm).toBe(5);
    expect(p.startsOn).toBeNull();
    expect(p.endsOn).toBeNull();
  });

  it('overrides win', () => {
    const p = makeTripPayload({
      prefix: 'unit',
      title: 'Paris',
      radiusKm: 20,
      startsOn: '2026-06-01',
    });
    expect(p.title).toBe('Paris');
    expect(p.radiusKm).toBe(20);
    expect(p.startsOn).toBe('2026-06-01');
  });
});

describe('test factories — expense payload', () => {
  it('defaults pass every Expense.create() invariant', () => {
    const p = makeExpensePayload({
      paidById: 'user_alice',
      splitShare: { user_alice: 0.5, user_bob: 0.5 },
    });
    expect(p.amountUsd).toBe('10.00');
    expect(p.currency).toBe('USD');
    const sum = Object.values(p.splitShare).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 4);
  });
});

describe('test factories — extractRefreshCookie', () => {
  it('handles a single Set-Cookie string', () => {
    expect(extractRefreshCookie('refresh_token=abc; Path=/; HttpOnly')).toBe('refresh_token=abc');
  });

  it('handles a Set-Cookie array', () => {
    expect(extractRefreshCookie(['session=xx; Path=/', 'refresh_token=zzz; HttpOnly'])).toBe(
      'refresh_token=zzz',
    );
  });

  it('throws when no refresh_token cookie present', () => {
    expect(() => extractRefreshCookie(['session=xx'])).toThrow(/no refresh_token/);
  });

  it('throws on undefined Set-Cookie', () => {
    expect(() => extractRefreshCookie(undefined)).toThrow(/no refresh_token/);
  });
});
