/**
 * Concrete `TokenService` — wraps `@app/auth`'s `signJwt` / `verifyJwt`
 * with a keyring resolved through the `JwtKeyringStore` port.
 *
 * Before [III.13.2.8] this service built its keyring once at module
 * init from env secrets + hardcoded `access-v1` / `refresh-v1`
 * kids; rotation required a full deploy. It now delegates keyring
 * retrieval to the store on every sign + verify, which:
 *   - lets `POST /admin/identity/jwks/rotate` take effect process-
 *     wide without restart,
 *   - keeps the multi-instance story clean (Redis is the source of
 *     truth; each instance hits its own 30s in-memory cache),
 *   - makes the eventual HS256 → RS256 swap an adapter change in
 *     the store, not a protocol shift here.
 *
 * TTL parsing stays here — expiries are policy, not key material.
 *
 * Installed by prompt [III.13.2] part 2. Refactored for rotation
 * in [III.13.2.8].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { signJwt, verifyJwt, type AccessTokenClaims, type RefreshTokenClaims } from '@app/auth';
import type { Env } from '@app/config';
import { JWT_KEYRING_STORE, type JwtKeyringStore } from '../application/ports/jwt-keyring.store';
import type {
  IssueAccessParams,
  IssueRefreshParams,
  IssuedToken,
  TokenService,
} from '../application/ports/token.service';

@Injectable()
export class JwtTokenService implements TokenService {
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;

  constructor(
    @Inject(ConfigService) config: ConfigService<Env, true>,
    @Inject(JWT_KEYRING_STORE) private readonly keyrings: JwtKeyringStore,
  ) {
    this.accessTtlSeconds = parseDuration(config.get('JWT_ACCESS_EXPIRY', { infer: true }));
    this.refreshTtlSeconds = parseDuration(config.get('JWT_REFRESH_EXPIRY', { infer: true }));
  }

  async issueAccessToken(params: IssueAccessParams): Promise<IssuedToken> {
    const claims: AccessTokenClaims = {
      sub: params.userId,
      sid: params.sessionId,
      role: params.role,
      typ: 'access',
    };
    const ring = await this.keyrings.getRing('access');
    const token = await signJwt(claims, ring.current, {
      expiresInSeconds: this.accessTtlSeconds,
    });
    return { token, expiresAt: futureDate(this.accessTtlSeconds) };
  }

  async issueRefreshToken(params: IssueRefreshParams): Promise<IssuedToken> {
    const claims: RefreshTokenClaims = {
      sub: params.userId,
      sid: params.sessionId,
      dfp: params.deviceFingerprint,
      typ: 'refresh',
    };
    const ring = await this.keyrings.getRing('refresh');
    const token = await signJwt(claims, ring.current, {
      expiresInSeconds: this.refreshTtlSeconds,
    });
    return { token, expiresAt: futureDate(this.refreshTtlSeconds) };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    const ring = await this.keyrings.getRing('access');
    return verifyJwt<AccessTokenClaims>(token, ring);
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenClaims> {
    const ring = await this.keyrings.getRing('refresh');
    return verifyJwt<RefreshTokenClaims>(token, ring);
  }
}

/**
 * Parse a `"15m"` / `"30d"` / `"12h"` / `"45s"` / bare seconds string
 * into a whole number of seconds. Supports: s, m, h, d. Anything else
 * throws — deliberately loud; the env schema already constrains these
 * to strings so validation lives here.
 */
export function parseDuration(value: string): number {
  const trimmed = value.trim();
  const match = /^(\d+)\s*([smhd]?)$/i.exec(trimmed);
  if (!match) {
    throw new Error(`invalid duration string: ${value}`);
  }
  const n = Number(match[1]);
  const unit = (match[2] ?? '').toLowerCase();
  switch (unit) {
    case 'd':
      return n * 86_400;
    case 'h':
      return n * 3_600;
    case 'm':
      return n * 60;
    case 's':
    case '':
      return n;
    default:
      throw new Error(`unsupported duration unit: ${unit}`);
  }
}

function futureDate(seconds: number, now: number = Date.now()): Date {
  // [M6] Accepts an explicit `now` so callers (which inject the Clock)
  // can roll time forward deterministically. The default keeps non-test
  // callers working without an audit.
  return new Date(now + seconds * 1000);
}
