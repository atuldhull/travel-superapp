/**
 * Port for minting + verifying access and refresh JWTs. Wraps the
 * `@app/auth` primitives (`signJwt` / `verifyJwt`) with the
 * access-token vs refresh-token policy split:
 *
 *   - Access tokens: short TTL (15m default), carry `role`, safe to log
 *     traffic of (never persist). Returned in the JSON body of
 *     /login · /register · /refresh.
 *
 *   - Refresh tokens: long TTL (30d default), carry the device-
 *     fingerprint hash (`dfp`), never returned in JSON — only set as
 *     an httpOnly cookie (CLAUDE rule 12).
 *
 * Installed by prompt [III.13.2] part 2.
 */
import type { AccessTokenClaims, RefreshTokenClaims } from '@app/auth';

export interface IssueAccessParams {
  readonly userId: string;
  readonly sessionId: string;
  readonly role: 'user' | 'premium' | 'agent' | 'admin' | 'compliance';
}

export interface IssueRefreshParams {
  readonly userId: string;
  readonly sessionId: string;
  /** Device fingerprint hash, 64 hex chars — Playbook §13.2. */
  readonly deviceFingerprint: string;
}

export interface IssuedToken {
  readonly token: string;
  readonly expiresAt: Date;
}

export interface TokenService {
  issueAccessToken(params: IssueAccessParams): Promise<IssuedToken>;
  issueRefreshToken(params: IssueRefreshParams): Promise<IssuedToken>;
  verifyAccessToken(token: string): Promise<AccessTokenClaims>;
  verifyRefreshToken(token: string): Promise<RefreshTokenClaims>;
}

export const TOKEN_SERVICE = Symbol('TokenService');
