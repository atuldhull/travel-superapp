/**
 * Port for user persistence, used by register + login. Kept minimal
 * for this slice — only what IssueSessionUseCase + RefreshSessionUseCase
 * actually need. Profile edits, preferences, MFA, OAuth links land in
 * their own prompts.
 *
 * Installed by prompt [III.13.2] part 2.
 */
export type UserRole = 'user' | 'premium' | 'agent' | 'admin';

export interface UserRecord {
  readonly id: string;
  readonly emailHash: string;
  readonly passwordHash: string | null;
  readonly role: UserRole;
  readonly displayName: string;
  readonly mfaEnabled: boolean;
  /**
   * base32-encoded TOTP shared secret. Null when MFA is off. Holds
   * a provisional value between `/mfa/setup` and `/mfa/verify` —
   * `mfaEnabled` is what LoginUseCase actually gates on.
   */
  readonly mfaSecret: string | null;
  /**
   * Flips to true the first time the user completes (or skips) the
   * 3-step onboarding wizard. Surfaced to the web client via
   * `GET /auth/me` so it can decide whether to bounce post-login →
   * /onboarding or → /trips.
   * Installed by prompt [V.UX.3].
   */
  readonly hasSeenOnboarding: boolean;
}

export interface CreateUserInput {
  readonly emailHash: string;
  readonly emailEncrypted: Buffer;
  /**
   * Argon2id hash of the user's password. `null` for OAuth-only
   * sign-ups (the schema already types this nullable). These users
   * can set a password later via a "add password to my account"
   * flow — deferred to a follow-up slice.
   */
  readonly passwordHash: string | null;
  readonly displayName: string;
}

export interface UserRepository {
  create(input: CreateUserInput): Promise<UserRecord>;
  findByEmailHash(emailHash: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;

  /**
   * Stage a TOTP secret during `/mfa/setup` — the user has scanned
   * the QR but hasn't proved they can generate codes yet. Keeps
   * `mfaEnabled` at its current value.
   */
  setMfaSecret(userId: string, base32Secret: string): Promise<void>;

  /**
   * Flip `mfaEnabled` to true after `/mfa/verify` succeeds. The
   * secret must already be staged by `setMfaSecret`.
   */
  confirmMfa(userId: string): Promise<void>;

  /**
   * Turn MFA off + drop the secret. Requires a valid code at the
   * use-case layer (defence against session-hijack account takeover).
   */
  disableMfa(userId: string): Promise<void>;

  /**
   * Idempotent: flip `hasSeenOnboarding` to true. Called when the user
   * completes (or skips) the onboarding wizard.
   * Installed by prompt [V.UX.3].
   */
  markOnboardingComplete(userId: string): Promise<void>;
}

export const USER_REPOSITORY = Symbol('UserRepository');
