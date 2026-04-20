/**
 * Refresh-token rotation with reuse-detection cascade.
 *
 * Flow on a valid refresh request:
 *   1. Verify the refresh JWT signature + expiry. (Belt.)
 *   2. Hash the raw refresh token + look the session up by hash.
 *      (Braces — if the JWT secret leaked but the DB didn't, the
 *      attacker still needs a hash that was persisted.)
 *   3. If the hash matches a row that is `revokedAt != null`, the
 *      presented token is a REPLAY of an already-rotated refresh
 *      token. This is the canonical reuse signal. Revoke every
 *      session for the user and reject.
 *   4. If the row is expired or missing, reject without cascade.
 *   5. Otherwise: atomically mark the old row revoked + insert a new
 *      row with a new refresh token + mint a new access token.
 *      Return the new pair.
 *
 * The cascade is the whole point: if an attacker exfiltrates a
 * refresh token + uses it once, rotation gives them a new token AND
 * revokes the original; when the legitimate user's device next
 * presents the (now old) token, we see a revoked row → reuse → wipe
 * every session for that user, forcing re-auth everywhere. This is
 * the OWASP refresh-token-rotation pattern.
 *
 * Installed by prompt [III.13.2] part 2.
 */
import { Inject, Injectable } from '@nestjs/common';
import { JwtVerificationError } from '@app/auth';
import { createLogger } from '@app/logger';
import { UnauthorizedError } from '@app/errors';
import type { Session } from '../domain/session.entity';
import { SESSION_REPOSITORY, type SessionRepository } from './ports/session.repository';
import { TOKEN_SERVICE, type TokenService } from './ports/token.service';
import { USER_REPOSITORY, type UserRepository } from './ports/user.repository';
import { sha256 } from './issue-session.use-case';

const log = createLogger('identity.refresh');

export interface RefreshSessionCommand {
  /** The raw refresh token lifted from the httpOnly cookie. */
  readonly refreshToken: string;
  readonly deviceFingerprint: string;
  readonly deviceId: string | null;
  readonly userAgent: string | null;
  readonly ipHash: string | null;
}

export interface RefreshedSession {
  readonly session: Session;
  readonly accessToken: string;
  readonly accessTokenExpiresAt: Date;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: Date;
}

@Injectable()
export class RefreshSessionUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
  ) {}

  async execute(cmd: RefreshSessionCommand): Promise<RefreshedSession> {
    // 1. Signature + expiry + algorithm checks. Rejects MISSING_KID /
    //    UNKNOWN_KID / INVALID up-front so we don't even touch the DB
    //    for nonsense inputs.
    let claims;
    try {
      claims = await this.tokens.verifyRefreshToken(cmd.refreshToken);
    } catch (err) {
      if (err instanceof JwtVerificationError) {
        throw new UnauthorizedError('Invalid refresh token', { code: err.code }, 'REFRESH_INVALID');
      }
      throw err;
    }

    // 2. Hash-lookup. Authoritative for reuse-detection.
    const hash = sha256(cmd.refreshToken);
    const row = await this.sessions.findByRefreshHash(hash);
    if (!row) {
      // Hash never existed — either forged or already rotated out of
      // the window we keep. Reject without cascade: we can't prove
      // this is the user's token at all.
      throw new UnauthorizedError('Session not found', {}, 'REFRESH_UNKNOWN');
    }

    // 3. Reuse cascade. If this row was already revoked and the same
    //    hash is being presented again, someone is replaying.
    if (row.revokedAt !== null) {
      const revoked = await this.sessions.revokeAllForUser(row.userId);
      log.warn({ userId: row.userId, sessionId: row.id, revoked }, 'refresh_token_reuse_detected');
      throw new UnauthorizedError(
        'Refresh token reuse detected — all sessions revoked',
        { userId: row.userId, sessionsRevoked: revoked },
        'REFRESH_REUSE_DETECTED',
      );
    }

    // 4. Expiry. No cascade — expiring is normal, revoke just this row.
    if (row.expiresAt.getTime() <= Date.now()) {
      await this.sessions.revoke(row.id);
      throw new UnauthorizedError('Session expired', {}, 'REFRESH_EXPIRED');
    }

    // 5. JWT `sid` must match the hashed row's id — defends against a
    //    JWT whose hash collides with a different session.
    if (claims.sid !== row.id) {
      throw new UnauthorizedError('Session identity mismatch', {}, 'REFRESH_SID_MISMATCH');
    }

    // 5b. Device-fingerprint binding. Stored fingerprint was computed
    //     at issuance as sha256(pepper + UA). If the current request
    //     derives a different fingerprint, the refresh is coming from
    //     a different user-agent than the one that logged in — treat
    //     as theft and cascade-revoke. Guard against legacy rows
    //     that predate this column (`deviceFingerprint === null`):
    //     those get grandfathered through without a check.
    if (row.deviceFingerprint !== null && row.deviceFingerprint !== cmd.deviceFingerprint) {
      const revoked = await this.sessions.revokeAllForUser(row.userId);
      log.warn(
        {
          userId: row.userId,
          sessionId: row.id,
          revoked,
          storedDfp: row.deviceFingerprint.slice(0, 8),
          presentedDfp: cmd.deviceFingerprint.slice(0, 8),
        },
        'refresh_device_fingerprint_mismatch',
      );
      throw new UnauthorizedError(
        'Refresh token presented from a different device — all sessions revoked',
        { userId: row.userId, sessionsRevoked: revoked },
        'REFRESH_DFP_MISMATCH',
      );
    }

    // Confirm the user still exists + isn't soft-deleted.
    const user = await this.users.findById(row.userId);
    if (!user) {
      await this.sessions.revoke(row.id);
      throw new UnauthorizedError('User no longer exists', {}, 'REFRESH_USER_MISSING');
    }

    // 6. Rotate atomically. The old row's `revokedAt` is set; the new
    //    row takes over. Attacker replaying the old cookie will now
    //    hit step 3's cascade.
    const { randomUUID } = await import('node:crypto');
    const newSessionId = randomUUID();

    const newRefresh = await this.tokens.issueRefreshToken({
      userId: user.id,
      sessionId: newSessionId,
      deviceFingerprint: cmd.deviceFingerprint,
    });
    const newHash = sha256(newRefresh.token);

    const newRow = await this.sessions.rotate(row.id, {
      id: newSessionId,
      userId: user.id,
      refreshTokenHash: newHash,
      deviceId: cmd.deviceId,
      userAgent: cmd.userAgent,
      ipHash: cmd.ipHash,
      deviceFingerprint: cmd.deviceFingerprint,
      expiresAt: newRefresh.expiresAt,
    });

    const newAccess = await this.tokens.issueAccessToken({
      userId: user.id,
      sessionId: newRow.id,
      role: user.role,
    });

    return {
      session: newRow,
      accessToken: newAccess.token,
      accessTokenExpiresAt: newAccess.expiresAt,
      refreshToken: newRefresh.token,
      refreshTokenExpiresAt: newRefresh.expiresAt,
    };
  }
}
