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
}

export const ACCOUNT_DELETER = Symbol('ACCOUNT_DELETER');
