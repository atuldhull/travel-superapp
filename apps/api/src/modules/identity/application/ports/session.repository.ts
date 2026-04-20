/**
 * Port for session persistence. Infrastructure layer provides the
 * concrete Prisma adapter; use-cases depend only on this interface so
 * they stay DB-agnostic and unit-testable with an in-memory fake.
 *
 * Dependency direction (ADR-001): application → domain. Infrastructure
 * implements this port; use-cases never reach into Prisma directly.
 *
 * Installed by prompt [III.13.2] part 2.
 */
import type { Session } from '../../domain/session.entity';

export interface CreateSessionInput {
  /**
   * Caller-supplied id so the JWT's `sid` claim signed during session
   * issuance matches the persisted row — lets us keep the JWT → row
   * link without a round-trip. The caller generates it with a CSPRNG.
   */
  readonly id: string;
  readonly userId: string;
  readonly refreshTokenHash: string;
  readonly deviceId: string | null;
  readonly userAgent: string | null;
  readonly ipHash: string | null;
  /**
   * sha256(pepper + userAgent). Stored at issuance so `/refresh` can
   * compare against a newly-derived fingerprint and detect a stolen
   * token presented from a different user-agent.
   */
  readonly deviceFingerprint: string;
  readonly expiresAt: Date;
}

export interface SessionRepository {
  /** Insert a fresh session row. Returns the persisted record. */
  create(input: CreateSessionInput): Promise<Session>;

  /**
   * Look up the session whose stored hash matches the presented refresh
   * token's hash. Returns `null` if none exists — caller must treat
   * that as an unauthenticated request, not as a reuse event (the hash
   * simply doesn't map to any session we've ever issued).
   */
  findByRefreshHash(refreshTokenHash: string): Promise<Session | null>;

  /**
   * Atomically rotate a session: mark the old row revoked and insert
   * the new row. Keeps the old hash queryable for reuse-detection while
   * the new session takes effect. Called by `RefreshSessionUseCase`.
   */
  rotate(oldSessionId: string, next: CreateSessionInput): Promise<Session>;

  /**
   * Revoke a single session (logout). Idempotent — revoking an already
   * revoked session is a no-op. Returns the revoked row for logging.
   */
  revoke(sessionId: string): Promise<void>;

  /**
   * Revoke every non-revoked session for a user. This is the
   * reuse-detection blast radius: if any refresh token is replayed
   * after rotation, we assume the user's device state is compromised
   * and force re-authentication on every device. Returns the count
   * actually revoked, for audit logging.
   */
  revokeAllForUser(userId: string): Promise<number>;

  /**
   * Return every currently-active (not revoked, not expired) session
   * for a user, ordered oldest-first. Used by `IssueSessionUseCase`
   * to enforce the per-user concurrency cap — when length > N, the
   * oldest (length - N) sessions are revoked.
   */
  listActiveForUser(userId: string): Promise<readonly Session[]>;
}

/** DI token — interface types erase at runtime so we need a value to inject on. */
export const SESSION_REPOSITORY = Symbol('SessionRepository');
