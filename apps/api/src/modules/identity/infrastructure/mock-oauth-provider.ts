/**
 * Deterministic mock OAuth provider. Accepts a raw JSON-encoded
 * profile as the "id token" and returns it after minimal shape
 * validation. For local dev + tests — NEVER registered in
 * production because it accepts unsigned input.
 *
 * Registered under the `mock` provider name. Production wiring
 * should either exclude this from the registry or `NODE_ENV`-gate
 * it inside the module. The registry layer handles that gating.
 *
 * Installed by prompt [III.13.2.6].
 */
import { Injectable } from '@nestjs/common';
import { UnauthorizedError } from '@app/errors';
import type { OAuthProfile, OAuthProvider } from '../application/ports/oauth-provider';

interface MockTokenShape {
  readonly providerUserId?: unknown;
  readonly email?: unknown;
  readonly emailVerified?: unknown;
  readonly displayName?: unknown;
}

@Injectable()
export class MockOAuthProvider implements OAuthProvider {
  async verifyIdToken(idToken: string): Promise<OAuthProfile> {
    let parsed: MockTokenShape;
    try {
      parsed = JSON.parse(idToken) as MockTokenShape;
    } catch {
      throw new UnauthorizedError('Invalid mock OAuth token', {}, 'OAUTH_INVALID_TOKEN');
    }
    if (typeof parsed.providerUserId !== 'string' || parsed.providerUserId.length === 0) {
      throw new UnauthorizedError('Invalid mock OAuth token', {}, 'OAUTH_INVALID_TOKEN');
    }
    if (typeof parsed.email !== 'string' || !parsed.email.includes('@')) {
      throw new UnauthorizedError('Invalid mock OAuth token', {}, 'OAUTH_INVALID_TOKEN');
    }
    if (parsed.emailVerified !== true) {
      throw new UnauthorizedError(
        'OAuth email not verified by provider',
        {},
        'OAUTH_EMAIL_UNVERIFIED',
      );
    }
    return {
      provider: 'mock',
      providerUserId: parsed.providerUserId,
      email: parsed.email.toLowerCase(),
      displayName:
        typeof parsed.displayName === 'string' && parsed.displayName.length > 0
          ? parsed.displayName
          : null,
    };
  }
}
