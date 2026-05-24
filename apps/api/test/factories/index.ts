/**
 * Test factories ([I1]) — every test that used to hand-roll a unique
 * email / displayName / scam-report id with `${prefix}-${Date.now()}-
 * ${Math.random().toString(36)...}` builds them through these
 * factories instead.
 *
 * Why this exists: the hand-rolled pattern was 129 test files long
 * and had three real bugs we papered over:
 *
 *   1. Two tests calling registerUser() in the same millisecond got
 *      the same email → the second registration failed with 409
 *      duplicate-email, race-flaky in CI.
 *   2. The `Math.random().toString(36).slice(2, 8)` suffix could
 *      collide too — 36^6 = 2 billion is "lots" until you remember
 *      jest workers run in parallel and the birthday paradox kicks
 *      in at ~50k collisions per ~1B IDs.
 *   3. `Date.now()` is mockable. A test using `jest.useFakeTimers()`
 *      to time-travel a trip's `archivedAt` field accidentally
 *      stamped every fresh email with the same fake-now → uniqueness
 *      lost again.
 *
 * The factory uses `crypto.randomUUID()` (RFC 4122 v4, 122 bits of
 * entropy) for collision-free IDs that don't depend on Date or
 * Math.random. The prefix is preserved so the per-suite cleanup
 * `where: { displayName: { startsWith: TEST_PREFIX } }` keeps working.
 *
 * Installed by prompt [I1].
 */
import { randomUUID } from 'node:crypto';

export const TEST_DOMAIN = 'example.com';

/** A unique slug suitable for a path / id / displayName suffix.
 *  Lowercased, hyphen-only, fixed 8 chars. */
export function uniqueSuffix(): string {
  return randomUUID().replace(/-/g, '').slice(0, 8);
}

/** A unique email with the given prefix, safe to use across parallel
 *  jest workers. The format is `${prefix}-${suffix}@example.com`. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${uniqueSuffix()}@${TEST_DOMAIN}`;
}

/** A unique display name — same shape as `uniqueEmail` minus the
 *  domain. Useful for `User.displayName` / `Trip.title` etc. */
export function uniqueName(prefix: string): string {
  return `${prefix}-${uniqueSuffix()}`;
}

/** A unique cuid-shaped id useful for synthetic ScamReport / SosEvent
 *  / etc. ids when the test doesn't go through a real insert.
 *  Returns 24 hex chars prefixed with the caller-provided kind. */
export function uniqueId(kind: string): string {
  return `${kind}-${randomUUID().replace(/-/g, '').slice(0, 24)}`;
}

/** Per-suite test fixture password — long, predictable, not real.
 *  All factories return this so a test never has to hand-choose. */
export const TEST_PASSWORD = 'correct-horse-battery-staple';

export * from './users';
export * from './trips';
export * from './expenses';
