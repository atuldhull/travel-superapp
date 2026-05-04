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
import type { AccountDeleter, SoftDeleteResult } from '../application/ports/account-deleter';

@Injectable()
export class PrismaAccountDeleter implements AccountDeleter {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async softDeleteAndRevokeSessions(userId: string, deletedAt: Date): Promise<SoftDeleteResult> {
    // V.UX.33 — read the row first so we can return the plaintext
    // email (utf8 decode of `emailEncrypted`) for the deletion-
    // pending notification. The actual write is still gated by
    // `updateMany ... where deletedAt: null` so a race-loser sees
    // ok=false.
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailEncrypted: true, deletedAt: true },
    });
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
    if (userUpdate.count !== 1) return { ok: false, email: null };
    const email =
      existing && existing.emailEncrypted.length > 0
        ? Buffer.from(existing.emailEncrypted).toString('utf8')
        : null;
    return { ok: true, email };
  }

  async restoreUser(userId: string): Promise<boolean> {
    // `deletedAt: { not: null }` clause = "set if currently
    // soft-deleted". Mirrors the `deletedAt: null` clause on
    // softDelete — both gates are atomic in Postgres.
    const result = await this.prisma.user.updateMany({
      where: { id: userId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    return result.count === 1;
  }

  async banUser(userId: string, bannedAt: Date, reason: string): Promise<boolean> {
    // V.UX.34 — set bannedAt + reason + revoke sessions in one
    // transaction. Idempotent: re-banning bumps the timestamp and
    // refreshes the reason (admin can update).
    const [userUpdate] = await this.prisma.$transaction([
      this.prisma.user.updateMany({
        where: { id: userId },
        data: { bannedAt, banReason: reason },
      }),
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: bannedAt },
      }),
    ]);
    return userUpdate.count === 1;
  }

  async unbanUser(userId: string): Promise<boolean> {
    const result = await this.prisma.user.updateMany({
      where: { id: userId, bannedAt: { not: null } },
      data: { bannedAt: null, banReason: null },
    });
    return result.count === 1;
  }
}
