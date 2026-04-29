/**
 * V.UX.20 — record a foodie's dish report on an eatery. Auth-gated
 * (caller's user-id stamped as `reportedBy`). Cheap validation only:
 *
 *   - dish name 1..120 chars (Zod-trimmed at the controller).
 *   - priceUsd optional; rounded to 2 decimals; range (0, 9999.99].
 *   - photoUrl optional; ≤ 1024 chars (URL or S3 pre-signed GET).
 *   - caption optional; ≤ 280 chars (Twitter-y; matches the
 *     memory-book asset caption cap from V.UX.11).
 *
 * 404 `EATERY_NOT_FOUND` when the target eatery row doesn't exist.
 * No idempotency key — multiple reports for the same dish-name are
 * allowed (different visits, different prices).
 *
 * Installed by prompt [V.UX.20].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError, ValidationError } from '@app/errors';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';

export interface AddDishReportCommand {
  readonly eateryId: string;
  readonly reporterId: string;
  readonly name: string;
  readonly priceUsd?: number;
  readonly photoUrl?: string;
  readonly caption?: string;
}

const MAX_PRICE_USD = 9999.99;

@Injectable()
export class AddDishReportUseCase {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async execute(cmd: AddDishReportCommand): Promise<{
    id: string;
    eateryId: string;
    name: string;
    priceUsd: string | null;
    photoUrl: string | null;
    caption: string | null;
    reportedBy: string;
    createdAt: Date;
  }> {
    if (cmd.priceUsd !== undefined) {
      if (!Number.isFinite(cmd.priceUsd) || cmd.priceUsd <= 0 || cmd.priceUsd > MAX_PRICE_USD) {
        throw new ValidationError(
          'priceUsd must be in (0, 9999.99]',
          { priceUsd: ['out of range'] },
          { priceUsd: cmd.priceUsd },
          'INVALID_DISH_PRICE',
        );
      }
    }

    const eatery = await this.prisma.eatery.findUnique({
      where: { id: cmd.eateryId },
      select: { id: true },
    });
    if (!eatery) {
      throw new NotFoundError('Eatery not found', { eateryId: cmd.eateryId }, 'EATERY_NOT_FOUND');
    }

    const data: Prisma.DishUncheckedCreateInput = {
      eateryId: cmd.eateryId,
      name: cmd.name,
      reportedBy: cmd.reporterId,
    };
    if (cmd.priceUsd !== undefined) {
      data.priceUsd = new Prisma.Decimal(cmd.priceUsd.toFixed(2));
    }
    if (cmd.photoUrl !== undefined) data.photoUrl = cmd.photoUrl;
    if (cmd.caption !== undefined) data.caption = cmd.caption;

    const row = await this.prisma.dish.create({ data });
    return {
      id: row.id,
      eateryId: row.eateryId,
      name: row.name,
      priceUsd: row.priceUsd === null ? null : row.priceUsd.toFixed(2),
      photoUrl: row.photoUrl,
      caption: row.caption,
      reportedBy: row.reportedBy ?? cmd.reporterId,
      createdAt: row.createdAt,
    };
  }
}
