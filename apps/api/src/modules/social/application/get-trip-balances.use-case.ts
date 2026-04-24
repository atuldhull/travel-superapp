/**
 * Compute per-user net balances for a trip — the "who owes whom"
 * ledger. Same auth gate as voting / expenses.
 *
 * Algorithm (v1, deliberately simple + auditable):
 *
 *   For each expense E with amount A, payer P, and split map S:
 *     credit[P] += A                    // P paid the whole bill
 *     for each (userId, share) in S:
 *       debit[userId] += A × share      // each participant owes their share
 *   net[user] = credit[user] - debit[user]
 *
 * Positive net → this user is owed money; negative → this user
 * owes the group. Sum over all users = 0 (modulo rounding).
 *
 * Rounding: we do the math in a cents-scaled integer then divide
 * by 100 at the end, giving us exact 2-dp output without float
 * drift. A trip with thousands of expenses still computes in O(n).
 *
 * **No settlement suggestions yet** — just the raw net per user.
 * A future slice can layer on a "pay Alice $12.50 to settle"
 * optimisation (graph simplification: K users need K-1 payments
 * minimum). Today we surface the flat balances + let the UI
 * render them.
 *
 * Installed by prompt [IV.18.12.4].
 */
import { Inject, Injectable } from '@nestjs/common';
import { TRIP_REPOSITORY, type TripRepository } from '../../trip/application/ports/trip.repository';
import {
  TRIP_SHARE_REPOSITORY,
  type TripShareRepository,
} from '../../trip/application/ports/trip-share.repository';
import type { UserBalance } from '../domain/expense.entity';
import { assertCanVote as assertTripAccess } from './cast-vote.use-case';
import { EXPENSE_REPOSITORY, type ExpenseRepository } from './ports/expense.repository';

export interface GetTripBalancesCommand {
  readonly tripId: string;
  readonly userId: string;
}

@Injectable()
export class GetTripBalancesUseCase {
  constructor(
    @Inject(EXPENSE_REPOSITORY) private readonly expenses: ExpenseRepository,
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(TRIP_SHARE_REPOSITORY) private readonly shares: TripShareRepository,
  ) {}

  async execute(cmd: GetTripBalancesCommand): Promise<readonly UserBalance[]> {
    await assertTripAccess(this.trips, this.shares, cmd.tripId, cmd.userId);
    // Pull every expense in one go — the aggregate math is
    // per-trip, not per-query, so fetching all rows once and
    // computing in JS is simpler than N GROUP BYs. 500 cap from
    // the repo is the safety rail.
    const rows = await this.expenses.listForTrip(cmd.tripId, 500);

    // Work in cents (2-dp × 100) to avoid float drift. All
    // amounts are 2-dp fixed strings already.
    const netCents = new Map<string, number>();
    const bump = (u: string, dCents: number): void => {
      netCents.set(u, (netCents.get(u) ?? 0) + dCents);
    };

    for (const e of rows) {
      const amountCents = Math.round(Number(e.amountUsd) * 100);
      bump(e.paidById, amountCents);
      for (const [userId, share] of Object.entries(e.splitShare)) {
        const debitCents = Math.round(amountCents * share);
        bump(userId, -debitCents);
      }
    }

    const out: UserBalance[] = [];
    for (const [userId, cents] of netCents) {
      out.push({ userId, netUsd: (cents / 100).toFixed(2) });
    }
    // Sort: largest creditor first, largest debtor last.
    out.sort((a, b) => Number(b.netUsd) - Number(a.netUsd));
    return out;
  }
}
