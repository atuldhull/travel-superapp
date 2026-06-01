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

// ─── AE475 edge-case specs ────────────────────────────────────────────
// Boundary conditions for refetch timing. These nail down the contract
// around the expiry instant itself (=, just before, just after) and the
// extreme TTL inputs the Media API could plausibly emit (24h cache TTLs
// during dev, NaN/Infinity from corrupted upstream payloads, 0 margins
// in tests, negative deltas from clock skew).
describe('msUntilExpiry — AE475 boundary conditions', () => {
  it('returns exactly 0 when expiry === now', () => {
    const atNow = new Date(NOW).toISOString();
    expect(msUntilExpiry(atNow, NOW)).toBe(0);
  });
  it('returns negative ms when expiry is 1ms in the past', () => {
    const justPast = new Date(NOW - 1).toISOString();
    expect(msUntilExpiry(justPast, NOW)).toBe(-1);
  });
  it('handles very large TTLs (24h) without overflow', () => {
    const in24h = new Date(NOW + 24 * 60 * 60 * 1000).toISOString();
    expect(msUntilExpiry(in24h, NOW)).toBe(24 * 60 * 60 * 1000);
  });
  it('handles 7-day TTLs without overflow', () => {
    const in7d = new Date(NOW + 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(msUntilExpiry(in7d, NOW)).toBe(7 * 24 * 60 * 60 * 1000);
  });
  it('returns NaN on the literal string "Infinity"', () => {
    expect(Number.isNaN(msUntilExpiry('Infinity', NOW))).toBe(true);
  });
  it('returns NaN on the literal string "NaN"', () => {
    expect(Number.isNaN(msUntilExpiry('NaN', NOW))).toBe(true);
  });
});

describe('refetchDelayMs — AE475 boundary conditions', () => {
  it('null when expiry === now (remaining is 0, treated as expired)', () => {
    const atNow = new Date(NOW).toISOString();
    expect(refetchDelayMs(atNow, NOW)).toBeNull();
  });
  it('null when expiry is 1ms in the past', () => {
    const justPast = new Date(NOW - 1).toISOString();
    expect(refetchDelayMs(justPast, NOW)).toBeNull();
  });
  it('returns 0 at the exact 30s-before-expiry boundary', () => {
    // 30s out + 30s default margin → remaining (30_000) <= margin (30_000) → 0.
    const in30s = new Date(NOW + 30_000).toISOString();
    expect(refetchDelayMs(in30s, NOW)).toBe(0);
  });
  it('returns 1 when remaining is exactly margin + 1 ms', () => {
    const inMarginPlus1 = new Date(NOW + DEFAULT_TTL_REFETCH_MARGIN_MS + 1).toISOString();
    expect(refetchDelayMs(inMarginPlus1, NOW)).toBe(1);
  });
  it('margin = 0 treats any future TTL as comfortably ahead', () => {
    // remaining > 0 and !<= 0 (margin) → returns remaining - 0 === remaining.
    expect(refetchDelayMs(IN_5_MIN, NOW, 0)).toBe(5 * 60 * 1000);
  });
  it('margin = 0 still returns null when already expired', () => {
    expect(refetchDelayMs(PAST, NOW, 0)).toBeNull();
  });
  it('survives a 24h TTL with the default 30s margin', () => {
    const in24h = new Date(NOW + 24 * 60 * 60 * 1000).toISOString();
    expect(refetchDelayMs(in24h, NOW)).toBe(24 * 60 * 60 * 1000 - DEFAULT_TTL_REFETCH_MARGIN_MS);
  });
  it('custom margin larger than the TTL collapses to 0', () => {
    // 1 min out, 10 min margin → 0 (refetch ASAP, well inside margin).
    expect(refetchDelayMs(IN_1_MIN, NOW, 10 * 60_000)).toBe(0);
  });
  it('NaN margin propagates safely (remaining - NaN is NaN, but is finite check guards remaining only)', () => {
    // remaining is finite & positive; remaining <= NaN is false; returns remaining - NaN = NaN.
    // Documents the current behaviour — callers should not pass NaN margins.
    const out = refetchDelayMs(IN_5_MIN, NOW, Number.NaN);
    expect(Number.isNaN(out as number)).toBe(true);
  });
});

describe('isExpiryNear — AE475 boundary conditions', () => {
  it('true at the exact margin boundary (remaining === margin)', () => {
    const inMargin = new Date(NOW + DEFAULT_TTL_REFETCH_MARGIN_MS).toISOString();
    expect(isExpiryNear(inMargin, NOW)).toBe(true);
  });
  it('false 1ms past the margin boundary', () => {
    const inMarginPlus1 = new Date(NOW + DEFAULT_TTL_REFETCH_MARGIN_MS + 1).toISOString();
    expect(isExpiryNear(inMarginPlus1, NOW)).toBe(false);
  });
  it('true when expiry === now', () => {
    const atNow = new Date(NOW).toISOString();
    expect(isExpiryNear(atNow, NOW)).toBe(true);
  });
  it('false for a 24h-distant TTL under default margin', () => {
    const in24h = new Date(NOW + 24 * 60 * 60 * 1000).toISOString();
    expect(isExpiryNear(in24h, NOW)).toBe(false);
  });
  it('margin = 0 still flags an already-expired URL as near', () => {
    expect(isExpiryNear(PAST, NOW, 0)).toBe(true);
  });
  it('margin = 0 does NOT flag a 1ms-future URL', () => {
    const in1ms = new Date(NOW + 1).toISOString();
    expect(isExpiryNear(in1ms, NOW, 0)).toBe(false);
  });
});
