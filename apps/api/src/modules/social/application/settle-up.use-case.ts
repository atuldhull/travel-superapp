/**
 * "Settle up" suggestions — translate the per-user net balances into
 * a minimum-cashflow set of transfers that zero everyone out. K
 * users with non-zero balances need at most K-1 transfers; this is
 * provably optimal when payments can be arbitrary amounts.
 *
 * Algorithm (greedy max-creditor / max-debtor pairing):
 *   1. Compute net per user via `GetTripBalancesUseCase`.
 *   2. Split into creditors (positive net) + debtors (negative net).
 *   3. Repeatedly: pair the largest creditor with the largest debtor;
 *      transfer the smaller absolute amount; remove the now-zeroed
 *      side; continue until both sides are empty.
 *
 * The greedy pairing matches the "minimum-cashflow" classic — it's
 * not the absolute provable minimum number of transfers (that's
 * NP-hard), but it always produces ≤ K-1 transfers and is what every
 * Splitwise-style ledger uses in practice.
 *
 * Same auth gate as `GetTripBalancesUseCase`: owner OR active share.
 *
 * Installed by prompt [V.UX.8].
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  TRIP_REPOSITORY,
  TRIP_SHARE_REPOSITORY,
  type TripRepository,
  type TripShareRepository,
} from '../../trip';

import { assertCanVote as assertTripAccess } from './cast-vote.use-case';
import { GetTripBalancesUseCase } from './get-trip-balances.use-case';

export interface SettleUpCommand {
  readonly tripId: string;
  readonly userId: string;
}

export interface SettleTransfer {
  /** User who pays. */
  readonly fromUserId: string;
  /** User who receives. */
  readonly toUserId: string;
  /** USD amount as a 2dp string ("12.50"). */
  readonly amountUsd: string;
}

@Injectable()
export class SettleUpUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(TRIP_SHARE_REPOSITORY) private readonly shares: TripShareRepository,
    private readonly balances: GetTripBalancesUseCase,
  ) {}

  async execute(cmd: SettleUpCommand): Promise<readonly SettleTransfer[]> {
    await assertTripAccess(this.trips, this.shares, cmd.tripId, cmd.userId);

    const balances = await this.balances.execute(cmd);
    return computeMinimumCashflow(balances);
  }
}

/**
 * Pure function — exposed for unit tests + consumers that already
 * have a balance list and want the transfer plan without going
 * through the auth gate.
 */
export function computeMinimumCashflow(
  balances: ReadonlyArray<{ readonly userId: string; readonly netUsd: string }>,
): readonly SettleTransfer[] {
  // Work in cents (integer) to dodge float drift.
  const creditors: Array<{ userId: string; cents: number }> = [];
  const debtors: Array<{ userId: string; cents: number }> = [];

  for (const b of balances) {
    const cents = Math.round(Number(b.netUsd) * 100);
    if (cents > 0) creditors.push({ userId: b.userId, cents });
    else if (cents < 0) debtors.push({ userId: b.userId, cents });
  }

  // Sort largest first so each pair settles the most slack possible.
  creditors.sort((a, b) => b.cents - a.cents);
  debtors.sort((a, b) => a.cents - b.cents);

  const transfers: SettleTransfer[] = [];
  let i = 0;
  let j = 0;
  while (i < creditors.length && j < debtors.length) {
    const c = creditors[i]!;
    const d = debtors[j]!;
    const transferCents = Math.min(c.cents, -d.cents);
    if (transferCents > 0) {
      transfers.push({
        fromUserId: d.userId,
        toUserId: c.userId,
        amountUsd: (transferCents / 100).toFixed(2),
      });
      c.cents -= transferCents;
      d.cents += transferCents;
    }
    if (c.cents === 0) i++;
    if (d.cents === 0) j++;
  }
  return transfers;
}
