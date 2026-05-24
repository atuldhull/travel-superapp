/**
 * Record a paid-for-group expense on a trip. Same auth gate as
 * voting ([IV.18.12.3]): caller owns the trip OR the trip has an
 * active TripShare.
 *
 * Invariants enforced by `Expense.create()` ([F4] — used to live
 * inline in this file). The use-case is now a thin coordinator:
 * entity-create (validates) → auth-check → repo-persist →
 * cache-invalidate. `paidBy` is always the authed caller — a
 * bookkeeper who lets Alice add "Bob paid" for Bob is a future
 * feature.
 *
 * Installed by prompt [IV.18.12.4]; flattened by [F4].
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  TRIP_REPOSITORY,
  TRIP_SHARE_REPOSITORY,
  type TripRepository,
  type TripShareRepository,
} from '../../trip';

import { Expense, type SplitShareMap } from '../domain/expense.entity';
import {
  TRIP_BALANCES_CACHE_PORT,
  type TripBalancesCachePort,
} from './ports/trip-balances-cache.port';
import { assertCanVote as assertTripAccess } from './cast-vote.use-case';
import { EXPENSE_REPOSITORY, type ExpenseRepository } from './ports/expense.repository';

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
    // Domain-side validation: every invariant lives on the entity.
    const validated = Expense.create({
      tripId: cmd.tripId,
      paidById: cmd.payerId,
      amountUsd: cmd.amountUsd,
      currency: cmd.currency,
      note: cmd.note,
      splitShare: cmd.splitShare,
    });
    await assertTripAccess(this.trips, this.shares, cmd.tripId, cmd.payerId);
    const expense = await this.expenses.create(validated);
    // Invalidate the trip-balances cache so the next read
    // recomputes against the new expense set.
    await this.balancesCache.del(cmd.tripId);
    return expense;
  }
}
