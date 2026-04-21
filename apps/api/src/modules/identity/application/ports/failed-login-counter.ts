/**
 * Port for per-identity failed-login accounting. The Identity
 * module's LoginUseCase reads the current count before password
 * verification and increments on INVALID_CREDENTIALS. When the
 * count exceeds the threshold, login is locked out for the
 * remaining TTL.
 *
 * The counter key is `emailHash` (already peppered in
 * `email-hash.ts`) — NOT the plaintext email, so a DB dump of
 * the counter store can't be reverse-engineered into an account
 * enumeration list.
 *
 * Installed by prompt [IV.18.2.6].
 */
export interface FailedLoginRecord {
  /** Number of failed attempts in the current window. */
  readonly count: number;
  /** Time-to-live of the counter in ms (how long before the
   *  window rolls off, assuming no more increments). */
  readonly ttlMs: number;
}

export interface FailedLoginCounter {
  /**
   * Read-only probe. Returns `count: 0` when no record exists or
   * the window has rolled off. Called at the START of login to
   * decide whether to short-circuit into the locked-out branch.
   */
  get(emailHash: string): Promise<FailedLoginRecord>;

  /**
   * Bump the counter for an identity. Creates the record with a
   * windowed TTL on first failure, sliding forward on each
   * increment (so 5 failures spread across N seconds within the
   * window all count). Returns the POST-increment state.
   */
  increment(emailHash: string): Promise<FailedLoginRecord>;

  /** Clear the counter — called after a successful login. */
  reset(emailHash: string): Promise<void>;
}

export const FAILED_LOGIN_COUNTER = Symbol('FailedLoginCounter');
