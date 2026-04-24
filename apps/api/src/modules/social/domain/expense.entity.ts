/**
 * Plain-data `Expense` domain entity. Mirrors the Prisma row.
 *
 * Money is carried as a `string` (Decimal's DB type is
 * `numeric(10,2)`; Prisma returns a `Decimal.js` object that we
 * normalize to a 2-dp fixed string). JS `number` would introduce
 * binary-float drift for amounts like 33.33 / 3 — the whole
 * point of using `@db.Decimal(10,2)` is to avoid that. Strings
 * preserve exact precision on the wire + are easy for clients to
 * render without rounding surprises.
 *
 * `splitShare` is a `{userId: number}` map. Shares sum to 1.0
 * (e.g. `{alice: 0.5, bob: 0.25, carol: 0.25}` = 3-way split
 * with Alice at half). The use-case enforces the sum invariant;
 * the repo is shape-agnostic.
 *
 * Installed by prompt [IV.18.12.4].
 */
export type SplitShareMap = Readonly<Record<string, number>>;

export interface Expense {
  readonly id: string;
  readonly tripId: string;
  readonly paidById: string;
  readonly amountUsd: string;
  readonly currency: string;
  readonly note: string | null;
  readonly splitShare: SplitShareMap;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Per-user net balance on a trip. Positive = owed TO this user
 * (they paid more than their share); negative = this user owes
 * the group. All balances for a trip sum to zero (modulo rounding).
 * Amounts are strings (see above).
 */
export interface UserBalance {
  readonly userId: string;
  readonly netUsd: string;
}
