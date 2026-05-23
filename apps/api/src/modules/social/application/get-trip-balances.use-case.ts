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
import {
  TRIP_REPOSITORY,
  TRIP_SHARE_REPOSITORY,
  type TripRepository,
  type TripShareRepository,
} from '../../trip';

import type { UserBalance } from '../domain/expense.entity';
import {
  TRIP_BALANCES_CACHE_PORT,
  type TripBalancesCachePort,
} from './ports/trip-balances-cache.port';
import { assertCanVote as assertTripAccess } from './cast-vote.use-case';
import { EXPENSE_REPOSITORY, type ExpenseRepository } from './ports/expense.repository';

/** 5 minutes — short enough that a missed invalidation
 *  self-heals quickly; long enough that the cache actually
 *  pays off on a screen that polls or re-renders. */
const TRIP_BALANCES_CACHE_TTL_SECONDS = 300;

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
    @Inject(TRIP_BALANCES_CACHE_PORT) private readonly cache: TripBalancesCachePort,
  ) {}

  async execute(cmd: GetTripBalancesCommand): Promise<readonly UserBalance[]> {
    // Auth gate runs BEFORE cache read so a stranger probing
    // a guessed tripId can't pull a cached result. Same
    // posture trip-overview uses for ownership.
    await assertTripAccess(this.trips, this.shares, cmd.tripId, cmd.userId);

    const cached = await this.cache.get(cmd.tripId);
    if (cached !== null) return cached;

    const fresh = await this.compute(cmd.tripId);
    await this.cache.set(cmd.tripId, fresh, TRIP_BALANCES_CACHE_TTL_SECONDS);
    return fresh;
  }

  private async compute(tripId: string): Promise<readonly UserBalance[]> {
    // Pull every expense in one go — the aggregate math is
    // per-trip, not per-query, so fetching all rows once and
    // computing in JS is simpler than N GROUP BYs. 500 cap from
    // the repo is the safety rail.
    const rows = await this.expenses.listForTrip(tripId, 500);

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
