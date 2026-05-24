/**
 * Expense factories ([I1]). Builds payloads ready for either
 * `POST /api/v1/trips/:id/expenses` (the wire shape) or the
 * `Expense.create()` domain factory ([F4]).
 *
 * Installed by prompt [I1].
 */
export interface MakeExpensePayloadOptions {
  readonly paidById: string;
  /** Map of `{userId: share}` summing to 1.0 ± 0.0001 (entity I6). */
  readonly splitShare: Readonly<Record<string, number>>;
  readonly tripId?: string;
  readonly amountUsd?: string;
  readonly currency?: string;
  readonly note?: string | null;
}

/** Returns an expense payload that satisfies every entity invariant
 *  by default (amount = "10.00", currency = "USD", splitShare valid).
 *  Override individual fields for negative-path tests. */
export function makeExpensePayload(opts: MakeExpensePayloadOptions): {
  readonly tripId: string;
  readonly paidById: string;
  readonly amountUsd: string;
  readonly currency: string;
  readonly note: string | null;
  readonly splitShare: Readonly<Record<string, number>>;
} {
  return {
    tripId: opts.tripId ?? 'trip_test',
    paidById: opts.paidById,
    amountUsd: opts.amountUsd ?? '10.00',
    currency: opts.currency ?? 'USD',
    note: opts.note ?? null,
    splitShare: opts.splitShare,
  };
}
