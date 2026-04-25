/**
 * Port for the right-to-erasure soft-delete + session revoke. The
 * adapter wraps both writes in a `prisma.$transaction` so we can't
 * end up with `User.deletedAt` set but sessions still live (or
 * vice-versa).
 *
 * Why a port (not a direct cross-module call to Identity's
 * SessionRepository): keeps the clean-arch dependency graph
 * acyclic. AccountModule never imports IdentityModule's port; the
 * adapter does its own Prisma writes against the shared
 * `PrismaService`.
 *
 * Returns `false` when the user wasn't found OR was already
 * soft-deleted — the use-case maps that to 404. Idempotency on a
 * second delete is intentionally NOT supported here: an
 * already-deleted account hitting `DELETE /account` again is a
 * client bug worth surfacing, and the route requires an authed
 * call (which won't succeed once the user row is soft-deleted).
 *
 * Installed by prompt [IV.18.16.2].
 */
export interface AccountDeleter {
  /**
   * Returns `true` when a row was soft-deleted, `false` when the
   * user didn't exist or was already deleted.
   */
  softDeleteAndRevokeSessions(userId: string, deletedAt: Date): Promise<boolean>;
  /**
   * Reverse of `softDeleteAndRevokeSessions` — clears `deletedAt`
   * back to `null`. Sessions stay revoked (the user has to log
   * in again; we don't restore in-flight refresh tokens).
   *
   * Returns `true` when a row was actually restored, `false`
   * when the user didn't exist OR was not soft-deleted (already
   * active). Caller maps `false` to 404.
   *
   * Restore is only viable while the row is still in the
   * 7-day retention window before the hard-delete cron
   * (`[IV.18.16.3]`) sweeps it. Once swept, restore returns
   * `false` (row gone) — the user must re-register.
   *
   * Added by `[IV.18.18.1]` for admin unban.
   */
  restoreUser(userId: string): Promise<boolean>;
}

export const ACCOUNT_DELETER = Symbol('ACCOUNT_DELETER');
