/**
 * Port for an external OAuth/OIDC identity provider (Google, Apple,
 * ...). The `verifyIdToken` method is the only thing callers need —
 * given a provider-issued JWT, return a verified profile or throw.
 *
 * Each concrete adapter is responsible for:
 *   - Cryptographic signature verification (JWKS, issuer, audience).
 *   - Expiry + nonce checks.
 *   - Mapping provider-specific claims to the common `OAuthProfile`.
 *
 * `[III.13.2.6]` ships a Google adapter (real) and a mock (for tests
 * + local dev). Apple is a follow-up — the port shape already fits
 * it, just a new adapter.
 *
 * Installed by prompt [III.13.2.6].
 */
export interface OAuthProfile {
  /** Short provider name: "google" | "apple" | "mock". */
  readonly provider: string;
  /** Stable provider user id — Google's `sub`, Apple's `sub`. Never changes. */
  readonly providerUserId: string;
  /** Verified email from the provider. Providers may return unverified
   *  emails — adapters MUST reject those before returning. */
  readonly email: string;
  /** Display name hint — not every provider supplies this (Apple only
   *  sends the name on first sign-in). Nullable. */
  readonly displayName: string | null;
}

export interface OAuthProvider {
  verifyIdToken(idToken: string): Promise<OAuthProfile>;
}

/**
 * DI token for the provider registry — a simple record keyed by
 * provider short-name. The use-case picks the right adapter at
 * request time based on the `:provider` path param.
 */
export const OAUTH_PROVIDERS = Symbol('OAuthProviders');

export interface OAuthProviderRegistry {
  readonly get: (providerName: string) => OAuthProvider | undefined;
}
