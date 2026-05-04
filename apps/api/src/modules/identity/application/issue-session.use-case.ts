/**
 * Issue a fresh session for a user who has just authenticated. Called
 * by both `RegisterUseCase` and `LoginUseCase` once the user is known.
 *
 * Responsibilities:
 *   1. Generate a cryptographically-random refresh token (raw string
 *      for the cookie) + compute its sha256 (what we persist).
 *   2. Insert a Session row with the hash, device + UA + ipHash, and
 *      an expiry `refreshTtlSeconds` in the future.
 *   3. Sign the refresh JWT carrying `sub=userId`, `sid=sessionId`,
 *      `dfp=deviceFingerprint`. (We keep TWO forms of the refresh
 *      token in flight: the opaque random string the cookie carries,
 *      AND a signed JWT that ties the session id to the user. The
 *      sha256 of the OPAQUE string is what's stored — the JWT is a
 *      belt-and-braces integrity check on refresh.)
 *   4. Sign an access token.
 *
 * Simpler approach taken here: we use the JWT refresh token itself as
 * the thing that goes in the cookie, and store its sha256. The `dfp`
 * claim protects against token theft across devices; the hash-lookup
 * + revoke-all cascade protects against reuse after rotation. Opaque
 * random string + JWT dual-token is over-engineered for v1.
 *
 * Installed by prompt [III.13.2] part 2.
 */
import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '@app/events';
import { createLogger, getTraceContext } from '@app/logger';
import type { Session } from '../domain/session.entity';
import { makeSessionEvent, type SessionIssuedEvent } from '../domain/session.events';
import { SESSION_REPOSITORY, type SessionRepository } from './ports/session.repository';
import { TOKEN_SERVICE, type TokenService } from './ports/token.service';

const log = createLogger('identity.issue');

/**
 * Cap on simultaneously-active sessions per user. When an 11th login
 * arrives, the oldest active session is revoked — users keep a
 * rolling window of their most recent devices. A single per-user
 * concurrency cap is enough for v1; per-device-class caps (e.g. 3
 * web + 2 mobile) are a follow-up if product signals demand it.
 */
export const MAX_SESSIONS_PER_USER = 10;

export interface IssueSessionCommand {
  readonly userId: string;
  readonly role: 'user' | 'premium' | 'agent' | 'admin' | 'compliance';
  readonly deviceId: string | null;
  readonly userAgent: string | null;
  readonly ipHash: string | null;
  readonly deviceFingerprint: string;
}

export interface IssuedSession {
  readonly session: Session;
  readonly accessToken: string;
  readonly accessTokenExpiresAt: Date;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: Date;
}

@Injectable()
export class IssueSessionUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  async execute(cmd: IssueSessionCommand): Promise<IssuedSession> {
    const { randomUUID } = await import('node:crypto');
    // Provisional session id used as the `sid` claim. The persisted
    // row takes the same id so hash-lookups and JWT `sid` agree.
    const sessionId = randomUUID();

    const refresh = await this.tokens.issueRefreshToken({
      userId: cmd.userId,
      sessionId,
      deviceFingerprint: cmd.deviceFingerprint,
    });
    const refreshTokenHash = sha256(refresh.token);

    const session = await this.sessions.create({
      id: sessionId,
      userId: cmd.userId,
      refreshTokenHash,
      deviceId: cmd.deviceId,
      userAgent: cmd.userAgent,
      ipHash: cmd.ipHash,
      deviceFingerprint: cmd.deviceFingerprint,
      expiresAt: refresh.expiresAt,
    });

    // Concurrency cap — after the new row lands, count active
    // sessions for this user. If the cap is exceeded, revoke the
    // oldest ones (keeping the most recent MAX_SESSIONS_PER_USER).
    // Race condition note: two concurrent logins can both see count
    // == MAX and each create. Worst-case we end up with MAX + 1
    // briefly and the next login trims. Not worth a serializable
    // transaction for v1.
    const active = await this.sessions.listActiveForUser(cmd.userId);
    if (active.length > MAX_SESSIONS_PER_USER) {
      const toRevoke = active.slice(0, active.length - MAX_SESSIONS_PER_USER);
      for (const old of toRevoke) {
        await this.sessions.revoke(old.id);
      }
      log.info(
        { userId: cmd.userId, revoked: toRevoke.length, cap: MAX_SESSIONS_PER_USER },
        'session_concurrency_cap_enforced',
      );
    }

    const access = await this.tokens.issueAccessToken({
      userId: cmd.userId,
      sessionId: session.id,
      role: cmd.role,
    });

    const evt: SessionIssuedEvent = makeSessionEvent(
      'Identity.SessionIssued',
      {
        userId: cmd.userId,
        sessionId: session.id,
        userAgent: cmd.userAgent,
        ipHash: cmd.ipHash,
      },
      getTraceContext()?.traceId ? { traceId: getTraceContext()!.traceId } : {},
    );
    await this.events.publish(evt);

    return {
      session,
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken: refresh.token,
      refreshTokenExpiresAt: refresh.expiresAt,
    };
  }
}

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
