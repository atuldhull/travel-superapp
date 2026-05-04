import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import type { JWTPayload as JosePayload } from 'jose';

/**
 * JWT sign + verify primitives for TravelSuperApp access + refresh
 * tokens.
 *
 * HS256 today with a `kid` (key id) header on every token so we can
 * rotate secrets without flag-days. The verifier accepts tokens
 * signed with any `kid` present in the current `JwtKeyring` — the
 * keyring holds the current key + previous keys during a rotation
 * window. After the window, old kids drop out of the keyring and
 * tokens signed with them fail verification.
 *
 * Playbook §13.2 calls for JWKS eventually (asymmetric RS256/ES256
 * so downstream services can verify independently). The shape
 * here — `kid` header + keyring — is the same; switching to RS256
 * is a signer-swap, not a protocol change. Deferred to a follow-up
 * prompt that lands key-material management.
 *
 * Foundation for prompt [III.13.2]. See Playbook §13.2.
 */

/**
 * One signing key in the keyring. `secret` is the HS256 shared
 * secret (≥ 32 bytes recommended; the env schema enforces ≥ 32
 * chars). `kid` is the identifier advertised in every JWT header
 * signed with this key.
 */
export interface JwtKey {
  readonly kid: string;
  readonly secret: Uint8Array;
}

/**
 * Keyring — one "current" key for signing + any number of
 * "previous" keys the verifier still accepts. On rotation, push the
 * old `current` onto `previous` and generate a new `current`. Drop
 * a previous key once no outstanding tokens could have used it
 * (i.e. after the longest token TTL has elapsed past rotation —
 * 30d for refresh tokens per §13.2).
 */
export interface JwtKeyring {
  readonly current: JwtKey;
  readonly previous: readonly JwtKey[];
}

/**
 * App-level JWT claims. `sub` is always the user id. `sid` is the
 * session id (for refresh-token rotation + revocation). Extra
 * claims are flattened onto the payload, type-checked at call
 * sites.
 */
export interface AccessTokenClaims {
  readonly sub: string;
  readonly sid: string;
  readonly role: 'user' | 'premium' | 'agent' | 'admin' | 'compliance';
  readonly typ: 'access';
}

export interface RefreshTokenClaims {
  readonly sub: string;
  readonly sid: string;
  /** sha256 of the device fingerprint (ua + platform + device-id) — Playbook §13.2. */
  readonly dfp: string;
  readonly typ: 'refresh';
}

export type TokenClaims = AccessTokenClaims | RefreshTokenClaims;

export interface SignOptions {
  readonly expiresInSeconds: number;
  readonly issuer?: string;
  readonly audience?: string;
}

/**
 * Sign a JWT using `key`. `ttl` in seconds. Adds `iat` + `exp` +
 * `kid` header automatically.
 */
export async function signJwt(
  claims: TokenClaims,
  key: JwtKey,
  opts: SignOptions,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  let jwt = new SignJWT(claims as unknown as JosePayload)
    .setProtectedHeader({ alg: 'HS256', kid: key.kid })
    .setIssuedAt(now)
    .setExpirationTime(now + opts.expiresInSeconds);
  if (opts.issuer) jwt = jwt.setIssuer(opts.issuer);
  if (opts.audience) jwt = jwt.setAudience(opts.audience);
  return jwt.sign(key.secret);
}

export interface VerifyOptions {
  readonly issuer?: string;
  readonly audience?: string;
}

/**
 * Verify a JWT against `keyring`. Tries `current`, then each
 * `previous` key in order, until one succeeds. Returns the decoded
 * claims.
 *
 * Throws `JwtVerificationError` (with a stable `.code`) on failure:
 *   • `MISSING_KID`  — token has no `kid` header.
 *   • `UNKNOWN_KID`  — `kid` doesn't match any key in the keyring.
 *   • `INVALID`      — signature failed + expired / malformed token.
 */
export async function verifyJwt<TClaims extends TokenClaims>(
  token: string,
  keyring: JwtKeyring,
  opts: VerifyOptions = {},
): Promise<TClaims> {
  const kid = extractKid(token);
  if (!kid) throw new JwtVerificationError('MISSING_KID', 'token has no kid header');
  const candidates = [keyring.current, ...keyring.previous].filter((k) => k.kid === kid);
  if (candidates.length === 0) {
    throw new JwtVerificationError('UNKNOWN_KID', `kid ${kid} not in keyring`);
  }
  const joseOpts: { issuer?: string; audience?: string } = {};
  if (opts.issuer) joseOpts.issuer = opts.issuer;
  if (opts.audience) joseOpts.audience = opts.audience;
  let lastError: unknown;
  for (const key of candidates) {
    try {
      const { payload } = await jwtVerify(token, key.secret, joseOpts);
      return payload as unknown as TClaims;
    } catch (err) {
      lastError = err;
    }
  }
  const message = lastError instanceof Error ? lastError.message : 'token verification failed';
  throw new JwtVerificationError('INVALID', message);
}

/** Typed error for `verifyJwt` failures. */
export class JwtVerificationError extends Error {
  constructor(
    public readonly code: 'MISSING_KID' | 'UNKNOWN_KID' | 'INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'JwtVerificationError';
  }
}

// Re-export the one jose error type callers might want to pattern-match on.
export const { JWTExpired } = joseErrors;

/**
 * Convert a string (HS256 secret) to the `Uint8Array` jose expects.
 * Use at module-init time to build a `JwtKey`.
 */
export function secretFromString(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

// ─── internals ─────────────────────────────────────────────────────

/**
 * Parse the `kid` out of the JWT protected header WITHOUT verifying
 * the signature. jose's API requires the key first; we need the
 * kid to pick the key — so we do a tiny manual header decode.
 */
function extractKid(token: string): string | null {
  const firstDot = token.indexOf('.');
  if (firstDot === -1) return null;
  const headerB64 = token.slice(0, firstDot);
  try {
    const json = Buffer.from(headerB64, 'base64url').toString('utf8');
    const header = JSON.parse(json) as { kid?: unknown };
    return typeof header.kid === 'string' ? header.kid : null;
  } catch {
    return null;
  }
}
