/**
 * Port for persisting the (user ↔ OAuth provider identity) link.
 *
 * `(provider, providerUserId)` is the stable key — providers like
 * Google expose this as the `sub` claim, and it doesn't change when
 * the user's email does. Lookup by that tuple is the primary path;
 * fallback-by-email happens in the use-case layer, not here.
 *
 * Installed by prompt [III.13.2.6].
 */
export interface UserOAuthIdentity {
  readonly id: string;
  readonly userId: string;
  readonly provider: string;
  readonly providerUserId: string;
  readonly providerEmail: string | null;
  readonly linkedAt: Date;
}

export interface LinkIdentityInput {
  readonly userId: string;
  readonly provider: string;
  readonly providerUserId: string;
  readonly providerEmail: string | null;
}

export interface UserOAuthIdentityRepository {
  /**
   * Look up an existing link by the stable provider tuple. Returns
   * `null` when unlinked. The use-case maps a `null` result to
   * "unknown identity — try email-based linking or create a new user."
   */
  findByProviderUser(provider: string, providerUserId: string): Promise<UserOAuthIdentity | null>;

  /**
   * Insert a new identity link. The unique constraint on
   * `(provider, providerUserId)` enforces idempotency at the DB
   * level — callers that race each other get P2002 and the use-case
   * retries the lookup path.
   */
  link(input: LinkIdentityInput): Promise<UserOAuthIdentity>;
}

export const USER_OAUTH_IDENTITY_REPOSITORY = Symbol('UserOAuthIdentityRepository');
