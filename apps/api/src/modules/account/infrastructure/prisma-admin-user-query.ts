/**
 * Prisma adapter for `AdminUserQuery`. Builds a dynamic `where`
 * clause from optional filters + runs a parallel `findMany` /
 * `count` for the paginated list shape.
 *
 * The `q` filter is case-insensitive substring on `displayName`
 * via Prisma's `contains` + `mode: 'insensitive'` — relies on
 * Postgres' `ILIKE`. No ranking; admin search is keyboard +
 * scroll, not relevance-sorted.
 *
 * Installed by prompt [IV.18.18.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import type {
  AdminUserListInput,
  AdminUserListResult,
  AdminUserQuery,
  AdminUserRow,
} from '../application/ports/admin-user-query';

@Injectable()
export class PrismaAdminUserQuery implements AdminUserQuery {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(input: AdminUserListInput): Promise<AdminUserListResult> {
    const where: Prisma.UserWhereInput = {};
    if (input.role !== undefined) where.role = input.role;
    if (input.deleted === true) where.deletedAt = { not: null };
    else if (input.deleted === false) where.deletedAt = null;
    if (input.q !== undefined && input.q.length > 0) {
      where.displayName = { contains: input.q, mode: 'insensitive' };
    }

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: input.offset,
        take: input.limit,
        select: {
          id: true,
          emailHash: true,
          displayName: true,
          role: true,
          mfaEnabled: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { rows: rows as readonly AdminUserRow[], total };
  }
}
