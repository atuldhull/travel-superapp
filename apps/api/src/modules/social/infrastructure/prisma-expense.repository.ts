/**
 * Prisma adapter for `ExpenseRepository`. Direct delegate — no
 * raw SQL. `amountUsd` is carried across the seam as a string
 * (see `expense.entity.ts` for why); Prisma's `Decimal` takes
 * a string or number in `create({ data: ... })` and returns a
 * `Decimal.js` instance we normalize back to a 2-dp string.
 *
 * Installed by prompt [IV.18.12.4].
 */
import { Inject, Injectable } from '@nestjs/common';
import { Prisma, type Expense as PrismaExpense } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import type { Expense, SplitShareMap } from '../domain/expense.entity';
import type {
  CreateExpenseInput,
  ExpenseRepository,
} from '../application/ports/expense.repository';

@Injectable()
export class PrismaExpenseRepository implements ExpenseRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: CreateExpenseInput): Promise<Expense> {
    const row = await this.prisma.expense.create({
      data: {
        tripId: input.tripId,
        paidById: input.paidById,
        amountUsd: new Prisma.Decimal(input.amountUsd),
        currency: input.currency.toUpperCase(),
        note: input.note,
        splitShare: input.splitShare as Prisma.InputJsonValue,
      },
    });
    return toDomain(row);
  }

  async listForTrip(tripId: string, limit: number): Promise<readonly Expense[]> {
    const rows = await this.prisma.expense.findMany({
      where: { tripId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
    });
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<Expense | null> {
    const row = await this.prisma.expense.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async deleteForPayer(id: string, paidById: string): Promise<boolean> {
    // Scoped deleteMany — atomic "remove only if I paid for it"
    // check. count=0 means either the id is missing or the caller
    // isn't the payer; both collapse to 404 at the use-case.
    const result = await this.prisma.expense.deleteMany({
      where: { id, paidById },
    });
    return result.count === 1;
  }
}

function toDomain(row: PrismaExpense): Expense {
  return {
    id: row.id,
    tripId: row.tripId,
    paidById: row.paidById,
    // Prisma's Decimal.toFixed(2) gives us a deterministic 2-dp
    // string representation. toString() would vary (12 vs 12.00).
    amountUsd: row.amountUsd.toFixed(2),
    currency: row.currency,
    note: row.note,
    splitShare: (row.splitShare ?? {}) as SplitShareMap,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
