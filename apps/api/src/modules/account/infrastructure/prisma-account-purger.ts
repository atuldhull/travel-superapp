/**
 * Prisma adapter for `AccountPurger`. Single `deleteMany` —
 * Postgres handles the cascade across every user-scoped FK in
 * one transaction. No `prisma.$transaction` wrapper needed: the
 * cascade IS the transaction (Postgres FK enforcement runs
 * inside the same statement that triggered it).
 *
 * The `deletedAt: { not: null, lte: cutoff }` clause is the
 * gate: only rows that were soft-deleted AND have aged past the
 * cutoff are eligible. An active user (deletedAt null) can
 * never be swept by this query, even if a future bug sets a
 * malformed cutoff.
 *
 * Installed by prompt [IV.18.16.3].
 */
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/db/prisma.service';
import type { AccountPurger } from '../application/ports/account-purger';

@Injectable()
export class PrismaAccountPurger implements AccountPurger {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async purgeOlderThan(cutoff: Date): Promise<number> {
    const result = await this.prisma.user.deleteMany({
      where: { deletedAt: { not: null, lte: cutoff } },
    });
    return result.count;
  }
}
