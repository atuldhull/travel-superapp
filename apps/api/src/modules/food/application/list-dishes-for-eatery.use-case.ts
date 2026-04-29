/**
 * V.UX.20 — list dishes attached to an eatery. Public read; the
 * eatery page on web fetches this to render the dish-of-the-day
 * strip + the full dish list. Newest reports surfaced first so
 * fresh photos win the carousel.
 *
 * 404 `EATERY_NOT_FOUND` when the eatery row doesn't exist — keeps
 * the web client honest (vs. silently returning `[]`).
 *
 * Installed by prompt [V.UX.20].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { PrismaService } from '../../../common/db/prisma.service';

export interface DishView {
  readonly id: string;
  readonly eateryId: string;
  readonly name: string;
  readonly priceUsd: string | null;
  readonly photoUrl: string | null;
  readonly caption: string | null;
  readonly reportedBy: string | null;
  readonly createdAt: Date;
}

@Injectable()
export class ListDishesForEateryUseCase {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async execute(eateryId: string): Promise<readonly DishView[]> {
    const eatery = await this.prisma.eatery.findUnique({
      where: { id: eateryId },
      select: { id: true },
    });
    if (!eatery) {
      throw new NotFoundError('Eatery not found', { eateryId }, 'EATERY_NOT_FOUND');
    }
    const dishes = await this.prisma.dish.findMany({
      where: { eateryId },
      orderBy: { createdAt: 'desc' },
    });
    return dishes.map((d) => ({
      id: d.id,
      eateryId: d.eateryId,
      name: d.name,
      // Prisma `Decimal` round-trips as a 2-decimal string at the api
      // boundary (matches ExpenseDto.amountUsd shape).
      priceUsd: d.priceUsd === null ? null : d.priceUsd.toFixed(2),
      photoUrl: d.photoUrl,
      caption: d.caption,
      reportedBy: d.reportedBy,
      createdAt: d.createdAt,
    }));
  }
}
