/**
 * List a trip's expenses. Same auth gate as voting — caller owns
 * the trip OR trip has an active share. Most-recent-first, default
 * 50, cap 500 (higher than votes because ledger readers often
 * want everything in one request).
 *
 * Installed by prompt [IV.18.12.4].
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  TRIP_REPOSITORY,
  TRIP_SHARE_REPOSITORY,
  type TripRepository,
  type TripShareRepository,
} from '../../trip';

import type { Expense } from '../domain/expense.entity';
import { assertCanVote as assertTripAccess } from './cast-vote.use-case';
import { EXPENSE_REPOSITORY, type ExpenseRepository } from './ports/expense.repository';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

export interface ListTripExpensesCommand {
  readonly tripId: string;
  readonly userId: string;
  readonly limit?: number;
}

@Injectable()
export class ListTripExpensesUseCase {
  constructor(
    @Inject(EXPENSE_REPOSITORY) private readonly expenses: ExpenseRepository,
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(TRIP_SHARE_REPOSITORY) private readonly shares: TripShareRepository,
  ) {}

  async execute(cmd: ListTripExpensesCommand): Promise<readonly Expense[]> {
    await assertTripAccess(this.trips, this.shares, cmd.tripId, cmd.userId);
    const clamped =
      cmd.limit === undefined
        ? DEFAULT_LIMIT
        : Math.max(1, Math.min(MAX_LIMIT, Math.floor(cmd.limit)));
    return this.expenses.listForTrip(cmd.tripId, clamped);
  }
}
