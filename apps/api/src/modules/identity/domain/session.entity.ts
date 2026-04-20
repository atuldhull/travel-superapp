/**
 * Plain-data domain `Session` — framework- and Prisma-free so the
 * application layer can reason about sessions without pulling
 * `@prisma/client` types into the domain. Mirrors the `Session` table
 * defined in `prisma/schema.prisma` ([III.12.1]).
 *
 * Refresh tokens themselves are NEVER stored on this object — only
 * `refreshTokenHash` (sha256). The raw token lives only in transit (in
 * the httpOnly cookie) and in the user's client.
 *
 * Installed by prompt [III.13.2] part 2.
 */
export interface Session {
  readonly id: string;
  readonly userId: string;
  readonly refreshTokenHash: string;
  readonly deviceId: string | null;
  readonly userAgent: string | null;
  readonly ipHash: string | null;
  /**
   * sha256(pepper + userAgent) computed at issuance. Compared against
   * a freshly-derived fingerprint on every `/refresh`. Nullable to
   * match the Prisma column, but `IssueSessionUseCase` always sets it.
   */
  readonly deviceFingerprint: string | null;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
}

/** Narrow helper: is this session still usable for a refresh? */
export function isSessionActive(session: Session, now: Date = new Date()): boolean {
  return session.revokedAt === null && session.expiresAt.getTime() > now.getTime();
}
