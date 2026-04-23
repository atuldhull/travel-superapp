/**
 * Apple Sign In / OIDC identity verifier. Sibling to
 * `GoogleOAuthProvider` — same shape, Apple-specific quirks:
 *
 *   - **Issuer**: `https://appleid.apple.com`.
 *   - **JWKS**: `https://appleid.apple.com/auth/keys`.
 *   - **Audience**: `APPLE_CLIENT_ID`. For mobile native this is the
 *     iOS bundle id (e.g. `com.example.travelapp`); for web it's the
 *     Services ID. A single adapter instance expects a single audience
 *     — if both platforms need to work, register two adapters under
 *     different provider names (`apple-ios`, `apple-web`).
 *   - **`email_verified`**: Apple sometimes returns this as the string
 *     `"true"` rather than boolean `true`. Coerce before checking.
 *   - **`email`**: may be a private relay address
 *     (`*@privaterelay.appleid.com`). Still valid — treat as normal.
 *   - **Name**: NOT in the ID token. Apple sends the user's name via a
 *     separate form field on first sign-in only, which the client has
 *     to pass through. v1 doesn't capture that — displayName falls
 *     back to email local-part when creating a new user. A follow-up
 *     slice can accept an optional `name` on the body.
 *
 * Requires `APPLE_CLIENT_ID` in env. Without it the module registry
 * skips this adapter entirely.
 *
 * Installed by prompt [III.13.2.7].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { Env } from '@app/config';
import { UnauthorizedError } from '@app/errors';
import type { OAuthProfile, OAuthProvider } from '../application/ports/oauth-provider';

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';

interface AppleIdTokenPayload extends JWTPayload {
  readonly sub?: string;
  readonly email?: string;
  /** Apple emits this as either boolean `true` or string `"true"`. */
  readonly email_verified?: boolean | string;
  /** Present when the user signs in with a private relay address. */
  readonly is_private_email?: boolean | string;
}

@Injectable()
export class AppleOAuthProvider implements OAuthProvider {
  private readonly jwks = createRemoteJWKSet(new URL(APPLE_JWKS_URL));
  private readonly audience: string;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    const clientId = config.get('APPLE_CLIENT_ID', { infer: true });
    if (!clientId) {
      throw new Error('AppleOAuthProvider requires APPLE_CLIENT_ID env var');
    }
    this.audience = clientId;
  }

  async verifyIdToken(idToken: string): Promise<OAuthProfile> {
    let payload: AppleIdTokenPayload;
    try {
      const verified = await jwtVerify(idToken, this.jwks, {
        issuer: APPLE_ISSUER,
        audience: this.audience,
      });
      payload = verified.payload as AppleIdTokenPayload;
    } catch (err) {
      throw new UnauthorizedError(
        'Apple ID token verification failed',
        { reason: err instanceof Error ? err.message : String(err) },
        'OAUTH_INVALID_TOKEN',
      );
    }

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new UnauthorizedError('Apple ID token missing sub claim', {}, 'OAUTH_INVALID_TOKEN');
    }
    if (typeof payload.email !== 'string' || !payload.email.includes('@')) {
      throw new UnauthorizedError('Apple ID token missing email claim', {}, 'OAUTH_INVALID_TOKEN');
    }
    // Coerce Apple's string-or-boolean `email_verified` to a real boolean.
    if (!coerceBool(payload.email_verified)) {
      throw new UnauthorizedError('Apple email not verified', {}, 'OAUTH_EMAIL_UNVERIFIED');
    }

    return {
      provider: 'apple',
      providerUserId: payload.sub,
      email: payload.email.toLowerCase(),
      // Apple never puts the name in the ID token. Use-case defaults
      // to email local-part when this is null.
      displayName: null,
    };
  }
}

function coerceBool(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return false;
}
