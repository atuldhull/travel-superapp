/** Vitest specs for AE405 URL TTL helpers. */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TTL_REFETCH_MARGIN_MS,
  isExpiryNear,
  msUntilExpiry,
  refetchDelayMs,
} from '../../src/components/aether/phase2/url-ttl';

const NOW = new Date('2026-06-15T10:00:00Z').getTime();
const IN_5_MIN = new Date('2026-06-15T10:05:00Z').toISOString();
const IN_1_MIN = new Date('2026-06-15T10:01:00Z').toISOString();
const PAST = new Date('2026-06-15T09:59:00Z').toISOString();

describe('DEFAULT_TTL_REFETCH_MARGIN_MS (pure)', () => {
  it('is 30 seconds', () => {
    expect(DEFAULT_TTL_REFETCH_MARGIN_MS).toBe(30_000);
  });
});

describe('msUntilExpiry (pure)', () => {
  it('positive when future', () => {
    expect(msUntilExpiry(IN_5_MIN, NOW)).toBe(5 * 60 * 1000);
  });
  it('negative when past', () => {
    expect(msUntilExpiry(PAST, NOW)).toBe(-60 * 1000);
  });
  it('NaN on null / undefined / empty', () => {
    expect(Number.isNaN(msUntilExpiry(null, NOW))).toBe(true);
    expect(Number.isNaN(msUntilExpiry(undefined, NOW))).toBe(true);
    expect(Number.isNaN(msUntilExpiry('', NOW))).toBe(true);
  });
  it('NaN on un-parseable string', () => {
    expect(Number.isNaN(msUntilExpiry('not a date', NOW))).toBe(true);
  });
});

describe('refetchDelayMs (pure)', () => {
  it('null when input is invalid', () => {
    expect(refetchDelayMs(null, NOW)).toBeNull();
    expect(refetchDelayMs(undefined, NOW)).toBeNull();
    expect(refetchDelayMs('junk', NOW)).toBeNull();
  });
  it('null when already expired', () => {
    expect(refetchDelayMs(PAST, NOW)).toBeNull();
  });
  it('0 when inside the margin window', () => {
    // 20s out + 30s margin → return 0 (refetch now).
    const in20s = new Date(NOW + 20_000).toISOString();
    expect(refetchDelayMs(in20s, NOW)).toBe(0);
  });
  it('returns remaining - margin when comfortably ahead', () => {
    // 5 min out, 30s margin → 4m30s = 270_000 ms.
    expect(refetchDelayMs(IN_5_MIN, NOW)).toBe(5 * 60 * 1000 - DEFAULT_TTL_REFETCH_MARGIN_MS);
  });
  it('honours a custom margin', () => {
    // 1 min out, 1.5 min margin → 0.
    expect(refetchDelayMs(IN_1_MIN, NOW, 90_000)).toBe(0);
    // 5 min out, 1 min margin → 4 min.
    expect(refetchDelayMs(IN_5_MIN, NOW, 60_000)).toBe(4 * 60 * 1000);
  });
});

describe('isExpiryNear (pure)', () => {
  it('false when input invalid', () => {
    expect(isExpiryNear(null, NOW)).toBe(false);
    expect(isExpiryNear('junk', NOW)).toBe(false);
  });
  it('true when remaining ≤ margin', () => {
    const in10s = new Date(NOW + 10_000).toISOString();
    expect(isExpiryNear(in10s, NOW)).toBe(true);
  });
  it('true when already expired', () => {
    expect(isExpiryNear(PAST, NOW)).toBe(true);
  });
  it('false when comfortably ahead', () => {
    expect(isExpiryNear(IN_5_MIN, NOW)).toBe(false);
  });
});
