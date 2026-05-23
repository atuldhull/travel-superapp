/**
 * Record a paid-for-group expense on a trip. Same auth gate as
 * voting ([IV.18.12.3]): caller owns the trip OR the trip has an
 * active TripShare.
 *
 * Validation:
 *   - `amountUsd` must match `^\d+(\.\d{1,2})?$` AND convert to a
 *     positive Decimal ≤ 99999999.99 (the schema's `numeric(10,2)`
 *     ceiling). Enforced in the use-case so the HTTP layer doesn't
 *     have to know the DB precision.
 *   - `currency` must be 3 uppercase letters (ISO 4217 shape —
 *     we don't validate against an ISO registry).
 *   - `splitShare` keys must include the payer (they ate the
 *     meal too) + every share must be > 0 AND ≤ 1 AND their sum
 *     must be 1.0 ± 0.0001 (float tolerance). Rejecting a 0-sum
 *     or >1-sum map at the use-case level avoids ambiguity at
 *     balance-computation time.
 *
 * `paidBy` is always the authed caller — a bookkeeper who lets
 * Alice add "Bob paid" for Bob is a future feature.
 *
 * Installed by prompt [IV.18.12.4].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '@app/errors';
import {
  TRIP_REPOSITORY,
  TRIP_SHARE_REPOSITORY,
  type TripRepository,
  type TripShareRepository,
} from '../../trip';

import type { Expense, SplitShareMap } from '../domain/expense.entity';
import {
  TRIP_BALANCES_CACHE_PORT,
  type TripBalancesCachePort,
} from './ports/trip-balances-cache.port';
import { assertCanVote as assertTripAccess } from './cast-vote.use-case';
import { EXPENSE_REPOSITORY, type ExpenseRepository } from './ports/expense.repository';

const AMOUNT_REGEX = /^\d+(\.\d{1,2})?$/;
const MAX_AMOUNT = 99_999_999.99;
const CURRENCY_REGEX = /^[A-Z]{3}$/;
const SHARE_SUM_TOLERANCE = 0.0001;

export interface CreateExpenseCommand {
  readonly tripId: string;
  readonly payerId: string;
  readonly amountUsd: string;
  readonly currency: string;
  readonly note: string | null;
  readonly splitShare: SplitShareMap;
}

@Injectable()
export class CreateExpenseUseCase {
  constructor(
    @Inject(EXPENSE_REPOSITORY) private readonly expenses: ExpenseRepository,
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(TRIP_SHARE_REPOSITORY) private readonly shares: TripShareRepository,
    @Inject(TRIP_BALANCES_CACHE_PORT) private readonly balancesCache: TripBalancesCachePort,
  ) {}

  async execute(cmd: CreateExpenseCommand): Promise<Expense> {
    this.validate(cmd);
    await assertTripAccess(this.trips, this.shares, cmd.tripId, cmd.payerId);
    const expense = await this.expenses.create({
      tripId: cmd.tripId,
      paidById: cmd.payerId,
      amountUsd: cmd.amountUsd,
      currency: cmd.currency.toUpperCase(),
      note: cmd.note,
      splitShare: cmd.splitShare,
    });
    // Invalidate the trip-balances cache so the next read
    // recomputes against the new expense set.
    await this.balancesCache.del(cmd.tripId);
    return expense;
  }

  private validate(cmd: CreateExpenseCommand): void {
    if (!AMOUNT_REGEX.test(cmd.amountUsd)) {
      throw new ValidationError(
        'Amount must be a positive decimal with at most 2 dp',
        { amountUsd: ['format: <int>.<up to 2 dp>'] },
        { amountUsd: cmd.amountUsd },
        'INVALID_AMOUNT',
      );
    }
    const num = Number(cmd.amountUsd);
    if (!Number.isFinite(num) || num <= 0 || num > MAX_AMOUNT) {
      throw new ValidationError(
        'Amount out of range',
        { amountUsd: [`must be in (0, ${MAX_AMOUNT}]`] },
        { amountUsd: cmd.amountUsd },
        'INVALID_AMOUNT',
      );
    }
    if (!CURRENCY_REGEX.test(cmd.currency.toUpperCase())) {
      throw new ValidationError(
        'Currency must be ISO 4217 (3 letters)',
        { currency: ['must be 3 uppercase letters'] },
        { currency: cmd.currency },
        'INVALID_CURRENCY',
      );
    }

    const entries = Object.entries(cmd.splitShare);
    if (entries.length === 0) {
      throw new ValidationError(
        'splitShare must have at least one participant',
        { splitShare: ['must be non-empty'] },
        {},
        'INVALID_SPLIT',
      );
    }
    let sum = 0;
    for (const [userId, share] of entries) {
      if (typeof userId !== 'string' || userId.length === 0) {
        throw new ValidationError(
          'splitShare keys must be non-empty strings',
          { splitShare: ['key malformed'] },
          {},
          'INVALID_SPLIT',
        );
      }
      if (typeof share !== 'number' || !Number.isFinite(share) || share <= 0 || share > 1) {
        throw new ValidationError(
          `splitShare[${userId}] must be in (0, 1]`,
          { splitShare: ['each share must be > 0 and ≤ 1'] },
          { userId, share },
          'INVALID_SPLIT',
        );
      }
      sum += share;
    }
    if (Math.abs(sum - 1) > SHARE_SUM_TOLERANCE) {
      throw new ValidationError(
        `splitShare must sum to 1.0 (got ${sum.toFixed(4)})`,
        { splitShare: ['sum must equal 1.0'] },
        { sum },
        'INVALID_SPLIT',
      );
    }
    if (cmd.splitShare[cmd.payerId] === undefined) {
      throw new ValidationError(
        'Payer must appear in splitShare (even at 0% — actually, use a follow-up "reimbursement" feature for that)',
        { splitShare: ['must include the payer'] },
        { payerId: cmd.payerId },
        'INVALID_SPLIT',
      );
    }
  }
}
