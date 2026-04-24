/**
 * Port for Expense persistence. Narrow — v1 is create / list /
 * delete. Edit (PATCH) can land in a follow-up if users complain;
 * today the UX is delete + re-create, which matches every
 * consumer Splitwise-style expense app.
 *
 * Installed by prompt [IV.18.12.4].
 */
import type { Expense, SplitShareMap } from '../../domain/expense.entity';

export interface CreateExpenseInput {
  readonly tripId: string;
  readonly paidById: string;
  /** Always a 2-dp fixed-string ("12.50"). Adapter converts to
   *  Prisma.Decimal on insert; use-case validates shape + sign. */
  readonly amountUsd: string;
  /** ISO 4217 3-letter code. Storage is `VARCHAR(3)` — uppercase
   *  at the adapter boundary. */
  readonly currency: string;
  readonly note: string | null;
  readonly splitShare: SplitShareMap;
}

export interface ExpenseRepository {
  create(input: CreateExpenseInput): Promise<Expense>;
  /** Most-recent-first. `limit` clamped by caller. */
  listForTrip(tripId: string, limit: number): Promise<readonly Expense[]>;
  findById(id: string): Promise<Expense | null>;
  /** Delete a row the caller paid for. Returns `true` iff a row
   *  was actually removed. Use-case maps `false` to 404. */
  deleteForPayer(id: string, paidById: string): Promise<boolean>;
}

export const EXPENSE_REPOSITORY = Symbol('ExpenseRepository');
