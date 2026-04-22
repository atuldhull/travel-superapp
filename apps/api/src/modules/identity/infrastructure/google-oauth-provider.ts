/**
 * Google OAuth2 / OIDC identity verifier. Given a Google-issued
 * ID token (JWT signed by one of Google's rotating RSA keys), this
 * adapter:
 *   1. Fetches Google's JWKS (cached via `createRemoteJWKSet`).
 *   2. Verifies signature, issuer (`https://accounts.google.com` or
 *      `accounts.google.com`), and audience (our `GOOGLE_CLIENT_ID`).
 *   3. Enforces `email_verified === true`.
 *   4. Returns an `OAuthProfile` with Google's `sub` as the stable
 *      `providerUserId`.
 *
 * Requires `GOOGLE_CLIENT_ID` in env. Without it, the constructor
 * throws — module wiring should conditionally register Google only
 * when the env var is set (so local dev without Google creds still
 * boots).
 *
 * Never store the raw ID token. It's used once here and discarded.
 *
 * Installed by prompt [III.13.2.6].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { Env } from '@app/config';
import { UnauthorizedError } from '@app/errors';
import type { OAuthProfile, OAuthProvider } from '../application/ports/oauth-provider';

const GOOGLE_ISSUERS: readonly string[] = ['https://accounts.google.com', 'accounts.google.com'];
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

interface GoogleIdTokenPayload extends JWTPayload {
  readonly sub?: string;
  readonly email?: string;
  readonly email_verified?: boolean;
  readonly name?: string;
  readonly given_name?: string;
}

@Injectable()
export class GoogleOAuthProvider implements OAuthProvider {
  private readonly jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  private readonly audience: string;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    const clientId = config.get('GOOGLE_CLIENT_ID', { infer: true });
    if (!clientId) {
      throw new Error('GoogleOAuthProvider requires GOOGLE_CLIENT_ID env var');
    }
    this.audience = clientId;
  }

  async verifyIdToken(idToken: string): Promise<OAuthProfile> {
    let payload: GoogleIdTokenPayload;
    try {
      const verified = await jwtVerify(idToken, this.jwks, {
        issuer: GOOGLE_ISSUERS as unknown as string[],
        audience: this.audience,
      });
      payload = verified.payload as GoogleIdTokenPayload;
    } catch (err) {
      throw new UnauthorizedError(
        'Google ID token verification failed',
        { reason: err instanceof Error ? err.message : String(err) },
        'OAUTH_INVALID_TOKEN',
      );
    }

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new UnauthorizedError('Google ID token missing sub claim', {}, 'OAUTH_INVALID_TOKEN');
    }
    if (typeof payload.email !== 'string' || !payload.email.includes('@')) {
      throw new UnauthorizedError('Google ID token missing email claim', {}, 'OAUTH_INVALID_TOKEN');
    }
    if (payload.email_verified !== true) {
      throw new UnauthorizedError('Google email not verified', {}, 'OAUTH_EMAIL_UNVERIFIED');
    }

    return {
      provider: 'google',
      providerUserId: payload.sub,
      email: payload.email.toLowerCase(),
      displayName:
        typeof payload.name === 'string' && payload.name.length > 0
          ? payload.name
          : typeof payload.given_name === 'string' && payload.given_name.length > 0
            ? payload.given_name
            : null,
    };
  }
}
