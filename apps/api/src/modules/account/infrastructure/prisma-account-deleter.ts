/**
 * Prisma adapter for `AccountDeleter`.
 *
 * Two-step write wrapped in `prisma.$transaction`:
 *   1. `updateMany({ id, deletedAt: null }, { deletedAt })` — the
 *      `deletedAt: null` clause makes the operation an atomic
 *      "set if not already deleted" gate. `count === 1` means
 *      we did the deletion in this call; `count === 0` means
 *      either the row is gone or someone else already soft-
 *      deleted it.
 *   2. `session.updateMany({ userId, revokedAt: null }, { revokedAt })`
 *      — best-effort revoke of every live refresh-token row.
 *      Refresh + reuse-detection in `RefreshSessionUseCase` will
 *      reject anything still in flight after the delete.
 *
 * Both writes happen in a single `$transaction([...])` so we can't
 * leave the system in a state where `User.deletedAt` is set but
 * sessions are still live. The transaction is local (no network
 * calls inside) — CLAUDE rule 13 ("never wrap network calls
 * inside prisma.$transaction") is satisfied.
 *
 * Installed by prompt [IV.18.16.2].
 */
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/db/prisma.service';
import type { AccountDeleter } from '../application/ports/account-deleter';

@Injectable()
export class PrismaAccountDeleter implements AccountDeleter {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async softDeleteAndRevokeSessions(userId: string, deletedAt: Date): Promise<boolean> {
    const [userUpdate] = await this.prisma.$transaction([
      this.prisma.user.updateMany({
        where: { id: userId, deletedAt: null },
        data: { deletedAt },
      }),
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: deletedAt },
      }),
    ]);
    return userUpdate.count === 1;
  }
}
