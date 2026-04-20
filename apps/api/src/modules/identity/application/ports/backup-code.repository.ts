/**
 * Port for MFA backup-code persistence. The use-case layer decides
 * when to generate / consume / clear; adapters implement persistence
 * against Postgres.
 *
 * Codes are returned ONLY at generation time — the plaintext is
 * shown to the user once and never persisted. What's stored is
 * `sha256(BACKUP_CODE_PEPPER + plaintext)`.
 *
 * Installed by prompt [III.13.2] part 5.
 */
export interface BackupCodeRepository {
  /**
   * Replace every existing backup code for the user with a fresh
   * batch of hashed codes. Returns the PLAINTEXT codes — the caller
   * hands them to the user once and never again.
   */
  regenerate(userId: string, count: number): Promise<readonly string[]>;

  /**
   * Attempt to consume a plaintext code. Returns `true` iff the hash
   * matches an unused row for the user (marks it `usedAt = now` in
   * the same transaction). Idempotent on re-consumption: a second
   * attempt with the same code returns `false`.
   */
  consume(userId: string, plaintext: string): Promise<boolean>;

  /** Number of unused codes remaining — surface it to the user so
   *  they see "N backup codes left" in the login response. */
  countRemaining(userId: string): Promise<number>;

  /** Drop every backup code for the user. Called by DisableMfaUseCase. */
  clearAll(userId: string): Promise<void>;
}

export const BACKUP_CODE_REPOSITORY = Symbol('BackupCodeRepository');
