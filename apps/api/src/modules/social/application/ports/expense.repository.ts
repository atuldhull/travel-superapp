/**
 * Port for Expense persistence. Narrow — v1 is create / list /
 * delete. Edit (PATCH) can land in a follow-up if users complain;
 * today the UX is delete + re-create, which matches every
 * consumer Splitwise-style expense app.
 *
 * Installed by prompt [IV.18.12.4].
 */
// `CreateExpenseInput` lives on the entity now — invariants moved
// there in [F4]. Re-export for backwards compat so existing imports
// (`from '../ports/expense.repository'`) still resolve.
export type { CreateExpenseInput } from '../../domain/expense.entity';
import type { CreateExpenseInput, Expense } from '../../domain/expense.entity';

export interface ExpenseRepository {
  create(input: CreateExpenseInput): Promise<Expense>;
  /** Most-recent-first. `limit` clamped by caller. */
  listForTrip(tripId: string, limit: number): Promise<readonly Expense[]>;
  findById(id: string): Promise<Expense | null>;
  /** Delete a row the caller paid for. Returns `{ tripId }` of
   *  the deleted row on success (so the caller can invalidate
   *  trip-scoped caches), or `null` when no row was removed
   *  (use-case maps `null` to 404). Signature widened in
   *  `[IV.18.10.4]` to support trip-balances cache invalidation
   *  without an extra `findById` round-trip. */
  deleteForPayer(id: string, paidById: string): Promise<{ tripId: string } | null>;
}

export const EXPENSE_REPOSITORY = Symbol('ExpenseRepository');
