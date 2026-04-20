/**
 * @app/auth — cryptographic primitives for TravelSuperApp's Identity
 * module. Foundation of Playbook §13.2.
 *
 * What's here (this package, today):
 *   • Password hashing + verify (argon2id at Playbook's cost
 *     parameters).
 *   • JWT sign + verify with `kid` header + key-rotation keyring
 *     shape. HS256 today; RS256/ES256 + JWKS endpoint is a
 *     signer-swap follow-up — protocol shape already future-proof.
 *
 * What's NOT here yet (separate prompts):
 *   • Refresh-token rotation + reuse-detection cascade.
 *   • TOTP MFA (speakeasy).
 *   • OAuth2 strategies (Google, Apple) via Passport.
 *   • JWKS key-rotation cron + Redis-backed keyring persistence.
 *   • NestJS guards (`JwtAuthGuard`, `RolesGuard`, `@CurrentUser()`).
 *   • Session concurrency cap + device-fingerprint binding.
 *
 * Consumers: apps/api (full) + workers (verify-only via
 * `verifyJwt`) per `docs/packages/manifest.md`.
 *
 * Installed by prompt [III.13.2] (foundation — part 1).
 */
export { hashPassword, verifyPassword, needsRehash } from './password';
export {
  signJwt,
  verifyJwt,
  JwtVerificationError,
  JWTExpired,
  secretFromString,
  type JwtKey,
  type JwtKeyring,
  type AccessTokenClaims,
  type RefreshTokenClaims,
  type TokenClaims,
  type SignOptions,
  type VerifyOptions,
} from './jwt';
