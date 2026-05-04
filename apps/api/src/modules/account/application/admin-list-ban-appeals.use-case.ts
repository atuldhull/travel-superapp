/**
 * V.UX.34 — admin queue for ban appeals. Filters by status; default
 * shows only pending. Newest first; capped + offset for pagination.
 *
 * Installed by prompt [V.UX.34].
 */
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/db/prisma.service';

export type BanAppealStatus = 'pending' | 'approved' | 'rejected';

export interface AdminListBanAppealsInput {
  readonly status?: BanAppealStatus;
  readonly limit?: number;
  readonly offset?: number;
}

export interface AdminListedBanAppeal {
  readonly id: string;
  readonly userId: string;
  readonly emailHash: string;
  readonly body: string;
  readonly status: BanAppealStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AdminListBanAppealsResult {
  readonly rows: readonly AdminListedBanAppeal[];
  readonly total: number;
}

@Injectable()
export class AdminListBanAppealsUseCase {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async execute(input: AdminListBanAppealsInput = {}): Promise<AdminListBanAppealsResult> {
    const status = input.status ?? 'pending';
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const offset = Math.max(input.offset ?? 0, 0);
    const [rows, total] = await Promise.all([
      this.prisma.banAppeal.findMany({
        where: { status },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.banAppeal.count({ where: { status } }),
    ]);
    return {
      rows: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        emailHash: r.emailHash,
        body: r.body,
        status: r.status as BanAppealStatus,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      total,
    };
  }
}
