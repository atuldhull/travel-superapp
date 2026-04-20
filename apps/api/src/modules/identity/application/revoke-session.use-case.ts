/**
 * Single-session revocation — the /logout endpoint. Accepts the raw
 * refresh token from the cookie, hashes it, and marks the matching
 * session revoked.
 *
 * Missing / invalid / already-revoked tokens are swallowed silently
 * (still return success). The goal is idempotence: a client may have
 * already lost its session and call /logout to clean up.
 *
 * Installed by prompt [III.13.2] part 2.
 */
import { Inject, Injectable } from '@nestjs/common';
import { SESSION_REPOSITORY, type SessionRepository } from './ports/session.repository';
import { sha256 } from './issue-session.use-case';

@Injectable()
export class RevokeSessionUseCase {
  constructor(@Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository) {}

  async execute(refreshToken: string | null | undefined): Promise<void> {
    if (!refreshToken) return;
    const row = await this.sessions.findByRefreshHash(sha256(refreshToken));
    if (!row || row.revokedAt !== null) return;
    await this.sessions.revoke(row.id);
  }
}
