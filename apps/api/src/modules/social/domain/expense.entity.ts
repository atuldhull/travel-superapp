/**
 * `Expense` domain entity — splitwise-style group expense on a trip.
 *
 * DDD refactor by [F4]: the invariants below (amount shape + range,
 * currency shape, split-share sum + bounds, payer-must-participate)
 * USED TO live inline in `CreateExpenseUseCase.validate()` — the
 * "anemic data bag + use-case" anti-pattern the road-to-10 review
 * called out. They now live on the entity itself, behind:
 *
 *   - `Expense.create(input)` — single entry point for NEW expenses
 *     (returns the validated input ready for repo persistence; the
 *     DB assigns id + timestamps).
 *   - `Expense.fromPersistence(row)` — single entry point for
 *     reconstructing an Expense from a DB row (no validation; DB
 *     rows are by construction already valid).
 *
 * The use-case shrinks to: auth-check → `Expense.create()` →
 * `repo.create()` → invalidate cache.
 *
 * Money is carried as a string (Decimal's DB type is `numeric(10,2)`;
 * Prisma returns a Decimal we normalize to a 2-dp fixed string).
 * `splitShare` is a `{userId: number}` map summing to 1.0 ± 0.0001.
 *
 * Installed by prompt [IV.18.12.4]; entity-ized by [F4].
 */
import { ValidationError } from '@app/errors';

export type SplitShareMap = Readonly<Record<string, number>>;

/** Amount string the entity accepts (and the DB stores). Lets the
 *  unit tests + the use-case talk in the same currency. */
const AMOUNT_REGEX = /^\d+(\.\d{1,2})?$/;
const MAX_AMOUNT = 99_999_999.99;
const CURRENCY_REGEX = /^[A-Z]{3}$/;
const SHARE_SUM_TOLERANCE = 0.0001;

/** Input shape for `Expense.create()` — the new-expense payload BEFORE
 *  the DB assigns id + timestamps. */
export interface CreateExpenseInput {
  readonly tripId: string;
  readonly paidById: string;
  /** 2-dp fixed string ("12.50"). Entity validates shape + range. */
  readonly amountUsd: string;
  /** ISO 4217 code (3 letters). Entity uppercases as a courtesy. */
  readonly currency: string;
  readonly note: string | null;
  readonly splitShare: SplitShareMap;
}

/** Row shape coming back from the Prisma adapter — id + timestamps
 *  filled in. The repo passes this to `Expense.fromPersistence()`. */
export interface ExpensePersistenceRow {
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

export class Expense {
  // Public readonly fields — same shape as the old `interface
  // Expense`, so consumers reading `.tripId` / `.amountUsd` /
  // `.splitShare` don't change.
  readonly id: string;
  readonly tripId: string;
  readonly paidById: string;
  readonly amountUsd: string;
  readonly currency: string;
  readonly note: string | null;
  readonly splitShare: SplitShareMap;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(row: ExpensePersistenceRow) {
    this.id = row.id;
    this.tripId = row.tripId;
    this.paidById = row.paidById;
    this.amountUsd = row.amountUsd;
    this.currency = row.currency;
    this.note = row.note;
    this.splitShare = row.splitShare;
    this.createdAt = row.createdAt;
    this.updatedAt = row.updatedAt;
  }

  /**
   * Validate + return a normalized CreateExpenseInput ready for
   * `ExpenseRepository.create()`. Throws `ValidationError` on any
   * invariant break. Does NOT instantiate an `Expense` because the
   * DB assigns id + timestamps — the repo round-trips through
   * `Expense.fromPersistence()` with the row it just wrote.
   *
   * Centralises every invariant the use-case used to inline:
   *   I1 amount matches `^\d+(\.\d{1,2})?$`
   *   I2 amount > 0 and ≤ 99,999,999.99 (numeric(10,2) ceiling)
   *   I3 currency uppercases to 3 letters (ISO 4217 shape)
   *   I4 splitShare is non-empty
   *   I5 every share is a finite number in (0, 1]
   *   I6 shares sum to 1.0 ± 0.0001
   *   I7 payer appears in splitShare
   */
  static create(input: CreateExpenseInput): CreateExpenseInput {
    // I1
    if (!AMOUNT_REGEX.test(input.amountUsd)) {
      throw new ValidationError(
        'Amount must be a positive decimal with at most 2 dp',
        { amountUsd: ['format: <int>.<up to 2 dp>'] },
        { amountUsd: input.amountUsd },
        'INVALID_AMOUNT',
      );
    }
    // I2
    const num = Number(input.amountUsd);
    if (!Number.isFinite(num) || num <= 0 || num > MAX_AMOUNT) {
      throw new ValidationError(
        'Amount out of range',
        { amountUsd: [`must be in (0, ${MAX_AMOUNT}]`] },
        { amountUsd: input.amountUsd },
        'INVALID_AMOUNT',
      );
    }
    // I3 (uppercase first so the caller doesn't have to)
    const currency = input.currency.toUpperCase();
    if (!CURRENCY_REGEX.test(currency)) {
      throw new ValidationError(
        'Currency must be ISO 4217 (3 letters)',
        { currency: ['must be 3 uppercase letters'] },
        { currency: input.currency },
        'INVALID_CURRENCY',
      );
    }
    // I4
    const entries = Object.entries(input.splitShare);
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
      // I5 (key + value)
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
    // I6
    if (Math.abs(sum - 1) > SHARE_SUM_TOLERANCE) {
      throw new ValidationError(
        `splitShare must sum to 1.0 (got ${sum.toFixed(4)})`,
        { splitShare: ['sum must equal 1.0'] },
        { sum },
        'INVALID_SPLIT',
      );
    }
    // I7
    if (input.splitShare[input.paidById] === undefined) {
      throw new ValidationError(
        'Payer must appear in splitShare',
        { splitShare: ['must include the payer'] },
        { payerId: input.paidById },
        'INVALID_SPLIT',
      );
    }
    return { ...input, currency };
  }

  /**
   * Wrap a persisted row in an `Expense` instance. The DB row is
   * by construction already valid (it satisfied the schema +
   * passed through `Expense.create()` on the way in), so no
   * validation runs here.
   */
  static fromPersistence(row: ExpensePersistenceRow): Expense {
    return new Expense(row);
  }
}

/**
 * Per-user net balance on a trip. Positive = owed TO this user
 * (they paid more than their share); negative = this user owes
 * the group. All balances for a trip sum to zero (modulo rounding).
 */
export interface UserBalance {
  readonly userId: string;
  readonly netUsd: string;
}
