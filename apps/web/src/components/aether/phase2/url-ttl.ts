/**
 * AE405 — pure helpers for refetching a presigned URL before it expires.
 *
 * The Media API hands out URLs with a ~5min TTL. AE401 caches them via
 * react-query's `staleTime: 4 * 60 * 1000` so a quick re-render reuses
 * the cached value, but a session left open past expiry would render
 * stale URLs whose Three.js texture loads 403. AE405 watches the
 * `expiresAt` timestamp and schedules a refetch a configurable margin
 * before the wall-clock TTL.
 *
 * Pure: no React, no fetch. The hook in `use-url-ttl.tsx` wires
 * `setTimeout` against the values these helpers compute.
 */

/** Default margin (ms) before TTL at which we refetch. 30s gives the
 *  texture loader time to receive the new URL and the new presigned GET
 *  to round-trip before the previous URL's signature actually expires. */
export const DEFAULT_TTL_REFETCH_MARGIN_MS = 30_000;

/** ms remaining until the URL expires from the caller's perspective.
 *  Negative when the URL has already lapsed. Returns NaN when the input
 *  is null / not parseable so the caller can short-circuit. */
export function msUntilExpiry(
  expiresAt: string | null | undefined,
  now: number = Date.now(),
): number {
  if (expiresAt === null || expiresAt === undefined || expiresAt === '') return Number.NaN;
  const t = new Date(expiresAt).getTime();
  if (!Number.isFinite(t)) return Number.NaN;
  return t - now;
}

/** Decide the delay (ms) until we should call `refetch()` for a URL
 *  with the given TTL.
 *
 *  Returns null when:
 *    - the TTL is already exceeded (caller should refetch immediately
 *      via a separate path)
 *    - the TTL is invalid / null
 *  Returns 0 when the TTL is inside the safety margin (refetch ASAP).
 *  Otherwise returns `msRemaining - margin`, the moment to schedule the
 *  refetch so the new URL arrives just before the old one expires. */
export function refetchDelayMs(
  expiresAt: string | null | undefined,
  now: number = Date.now(),
  marginMs: number = DEFAULT_TTL_REFETCH_MARGIN_MS,
): number | null {
  const remaining = msUntilExpiry(expiresAt, now);
  if (!Number.isFinite(remaining)) return null;
  if (remaining <= 0) return null;
  if (remaining <= marginMs) return 0;
  return remaining - marginMs;
}

/** Pure: true when we should treat the URL as "about to expire" right
 *  now. Used as a quick predicate when the consumer hasn't subscribed
 *  to TTL changes (e.g. one-shot evaluation on mount). */
export function isExpiryNear(
  expiresAt: string | null | undefined,
  now: number = Date.now(),
  marginMs: number = DEFAULT_TTL_REFETCH_MARGIN_MS,
): boolean {
  const remaining = msUntilExpiry(expiresAt, now);
  if (!Number.isFinite(remaining)) return false;
  return remaining <= marginMs;
}
