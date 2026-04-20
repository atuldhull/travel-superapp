/**
 * Concrete `TokenService` — wraps `@app/auth`'s `signJwt` / `verifyJwt`
 * with env-derived keyrings.
 *
 * Keyring shape: today we have a single active key id per token type
 * (`access-v1`, `refresh-v1`). `@app/auth` already supports a
 * rotation-aware keyring; the JWKS rotation cron + Redis-backed
 * keyring persistence are deferred to their own prompt. Swapping HS256
 * → RS256 is a signer-swap in `@app/auth`, not a shape change here.
 *
 * TTL parsing: `JWT_ACCESS_EXPIRY` + `JWT_REFRESH_EXPIRY` come from
 * env as `"15m"` / `"30d"` strings. We parse them to seconds once at
 * module init.
 *
 * Installed by prompt [III.13.2] part 2.
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  signJwt,
  verifyJwt,
  secretFromString,
  type AccessTokenClaims,
  type JwtKey,
  type JwtKeyring,
  type RefreshTokenClaims,
} from '@app/auth';
import type { Env } from '@app/config';
import type {
  IssueAccessParams,
  IssueRefreshParams,
  IssuedToken,
  TokenService,
} from '../application/ports/token.service';

@Injectable()
export class JwtTokenService implements TokenService {
  private readonly accessRing: JwtKeyring;
  private readonly refreshRing: JwtKeyring;
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    const accessKey: JwtKey = {
      kid: 'access-v1',
      secret: secretFromString(config.get('JWT_ACCESS_SECRET', { infer: true })),
    };
    const refreshKey: JwtKey = {
      kid: 'refresh-v1',
      secret: secretFromString(config.get('JWT_REFRESH_SECRET', { infer: true })),
    };
    this.accessRing = { current: accessKey, previous: [] };
    this.refreshRing = { current: refreshKey, previous: [] };

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
    const token = await signJwt(claims, this.accessRing.current, {
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
    const token = await signJwt(claims, this.refreshRing.current, {
      expiresInSeconds: this.refreshTtlSeconds,
    });
    return { token, expiresAt: futureDate(this.refreshTtlSeconds) };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    return verifyJwt<AccessTokenClaims>(token, this.accessRing);
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenClaims> {
    return verifyJwt<RefreshTokenClaims>(token, this.refreshRing);
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

function futureDate(seconds: number): Date {
  return new Date(Date.now() + seconds * 1000);
}
