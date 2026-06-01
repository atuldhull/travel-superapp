/**
 * AE491 — canvas-shared own behavioural spec for `url-ttl`.
 *
 * The web-side spec at apps/web/test/lib/aether-url-ttl.spec.ts pins
 * the consumer surface. This spec lives next to the module so the
 * Phase 4 native port can re-export from `@app/aether-canvas-shared`
 * and immediately verify the same math without standing up the web
 * suite. Each test pairs to a docstring contract in `src/url-ttl.ts`.
 */
import { DEFAULT_TTL_REFETCH_MARGIN_MS, isExpiryNear, msUntilExpiry, refetchDelayMs } from '../src';

const NOW = 1_700_000_000_000;
const iso = (offsetMs: number): string => new Date(NOW + offsetMs).toISOString();

describe('AE491 — msUntilExpiry', () => {
  it('returns positive ms when the URL is still in date', () => {
    expect(msUntilExpiry(iso(60_000), NOW)).toBe(60_000);
  });
  it('returns negative ms when the URL has already lapsed', () => {
    expect(msUntilExpiry(iso(-30_000), NOW)).toBe(-30_000);
  });
  it('returns 0 at the exact expiry moment', () => {
    expect(msUntilExpiry(iso(0), NOW)).toBe(0);
  });
  it('returns NaN for null + undefined + empty string', () => {
    expect(Number.isNaN(msUntilExpiry(null, NOW))).toBe(true);
    expect(Number.isNaN(msUntilExpiry(undefined, NOW))).toBe(true);
    expect(Number.isNaN(msUntilExpiry('', NOW))).toBe(true);
  });
  it('returns NaN for unparseable input', () => {
    expect(Number.isNaN(msUntilExpiry('not-a-date', NOW))).toBe(true);
  });
});

describe('AE491 — refetchDelayMs', () => {
  it('returns null when the URL has already expired', () => {
    expect(refetchDelayMs(iso(-1), NOW)).toBe(null);
  });
  it('returns null for invalid input', () => {
    expect(refetchDelayMs(null, NOW)).toBe(null);
    expect(refetchDelayMs('garbage', NOW)).toBe(null);
  });
  it('returns 0 when the URL is inside the safety margin', () => {
    expect(refetchDelayMs(iso(10_000), NOW)).toBe(0);
    expect(refetchDelayMs(iso(DEFAULT_TTL_REFETCH_MARGIN_MS), NOW)).toBe(0);
  });
  it('returns remaining - margin when the URL is comfortably in date', () => {
    const remaining = 5 * 60_000;
    expect(refetchDelayMs(iso(remaining), NOW)).toBe(remaining - DEFAULT_TTL_REFETCH_MARGIN_MS);
  });
  it('respects a caller-supplied margin', () => {
    expect(refetchDelayMs(iso(60_000), NOW, 10_000)).toBe(50_000);
    expect(refetchDelayMs(iso(60_000), NOW, 90_000)).toBe(0);
  });
});

describe('AE491 — isExpiryNear', () => {
  it('returns true when remaining <= margin', () => {
    expect(isExpiryNear(iso(5_000), NOW)).toBe(true);
    expect(isExpiryNear(iso(DEFAULT_TTL_REFETCH_MARGIN_MS), NOW)).toBe(true);
  });
  it('returns false when remaining > margin', () => {
    expect(isExpiryNear(iso(10 * 60_000), NOW)).toBe(false);
  });
  it('returns true when the URL has already lapsed (remaining is negative)', () => {
    expect(isExpiryNear(iso(-1_000), NOW)).toBe(true);
  });
  it('returns false for invalid input', () => {
    expect(isExpiryNear(null, NOW)).toBe(false);
    expect(isExpiryNear('garbage', NOW)).toBe(false);
  });
});

describe('AE491 — DEFAULT_TTL_REFETCH_MARGIN_MS sanity bounds', () => {
  it('is a positive integer in the (5s, 2min) tactile range', () => {
    expect(Number.isInteger(DEFAULT_TTL_REFETCH_MARGIN_MS)).toBe(true);
    expect(DEFAULT_TTL_REFETCH_MARGIN_MS).toBeGreaterThan(5_000);
    expect(DEFAULT_TTL_REFETCH_MARGIN_MS).toBeLessThan(120_000);
  });
});
