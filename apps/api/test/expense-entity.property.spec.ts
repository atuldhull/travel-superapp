/**
 * Property-based tests for `Expense.create()` ([I2]).
 *
 * The hand-written example tests in `expense-entity.unit.spec.ts`
 * prove a handful of point cases pass / fail. Property-based testing
 * proves a UNIVERSAL claim: "for any valid input, create() accepts;
 * for any input violating invariant N, create() throws code N."
 *
 * fast-check generates ~100 random inputs per property by default
 * and shrinks failing cases to a minimal counter-example — so when
 * a regression slips in, the failure message is actionable, not
 * "test case #47 of a 1000-case fuzz failed."
 *
 * Installed by prompt [I2].
 */
import fc from 'fast-check';
import { ValidationError } from '@app/errors';
import { Expense, type CreateExpenseInput } from '../src/modules/social/domain/expense.entity';

// ─────────────────────────────────────────────────────────────────────
// Arbitraries — building blocks
// ─────────────────────────────────────────────────────────────────────

/** Valid 2-dp money string in (0, 99,999,999.99]. */
const validAmount = fc
  .tuple(fc.integer({ min: 1, max: 99_999_998 }), fc.integer({ min: 0, max: 99 }))
  .map(([dollars, cents]) => `${dollars}.${String(cents).padStart(2, '0')}`);

/** A valid ISO 4217 currency code shape (3 uppercase letters). */
const validCurrency = fc
  .string({ minLength: 3, maxLength: 3, unit: 'grapheme-ascii' })
  .filter((s) => /^[A-Z]{3}$/.test(s.toUpperCase()))
  .map((s) => s.toUpperCase());

/** A non-empty userId string (mimics cuid shape). */
const userId = fc
  .string({ minLength: 6, maxLength: 32, unit: 'grapheme-ascii' })
  .filter((s) => s.trim().length > 0);

/** Split between N (2..6) distinct users, exact 1.0 sum.
 *  Returns `{ paidById, splitShare }` so the payer-must-participate
 *  invariant (I7) is satisfied by construction. */
const validSplit = fc.integer({ min: 2, max: 6 }).chain((n) =>
  fc.uniqueArray(userId, { minLength: n, maxLength: n, comparator: 'SameValue' }).map((ids) => {
    const share = 1 / n;
    const splitShare = Object.fromEntries(ids.map((id) => [id, share]));
    return { paidById: ids[0]!, splitShare };
  }),
);

/** A valid CreateExpenseInput — every invariant satisfied. */
const validExpense: fc.Arbitrary<CreateExpenseInput> = fc
  .record({
    tripId: fc
      .string({ minLength: 4, maxLength: 32, unit: 'grapheme-ascii' })
      .filter((s) => s.trim().length > 0),
    amountUsd: validAmount,
    currency: validCurrency,
    note: fc.option(fc.string({ maxLength: 200 }), { nil: null }),
  })
  .chain((base) =>
    validSplit.map((s) => ({
      ...base,
      paidById: s.paidById,
      splitShare: s.splitShare,
    })),
  );

// ─────────────────────────────────────────────────────────────────────
// Properties
// ─────────────────────────────────────────────────────────────────────

describe('Expense.create (property-based)', () => {
  it('P1: accepts every valid input + uppercases currency', () => {
    fc.assert(
      fc.property(validExpense, (input) => {
        const out = Expense.create(input);
        expect(out.currency).toBe(input.currency.toUpperCase());
        expect(out.amountUsd).toBe(input.amountUsd);
      }),
    );
  });

  it('P2: amount above the numeric(10,2) ceiling → INVALID_AMOUNT', () => {
    const above = fc.integer({ min: 100_000_000, max: 999_999_999 }).map((n) => `${n}.00`);
    fc.assert(
      fc.property(validExpense, above, (input, badAmount) => {
        try {
          Expense.create({ ...input, amountUsd: badAmount });
          throw new Error('expected throw');
        } catch (err) {
          expect(err).toBeInstanceOf(ValidationError);
          expect((err as ValidationError).code).toBe('INVALID_AMOUNT');
        }
      }),
    );
  });

  it('P3: any amount with > 2 decimal places → INVALID_AMOUNT', () => {
    const tooManyDp = fc
      .tuple(fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 100, max: 9_999_999 }))
      .map(([dollars, frac]) => `${dollars}.${frac}`);
    fc.assert(
      fc.property(validExpense, tooManyDp, (input, badAmount) => {
        try {
          Expense.create({ ...input, amountUsd: badAmount });
          throw new Error('expected throw');
        } catch (err) {
          expect(err).toBeInstanceOf(ValidationError);
          expect((err as ValidationError).code).toBe('INVALID_AMOUNT');
        }
      }),
    );
  });

  it('P4: any currency that is not 3 ASCII letters → INVALID_CURRENCY', () => {
    const badCurrency = fc.oneof(
      fc.string({ minLength: 1, maxLength: 2, unit: 'grapheme-ascii' }),
      fc.string({ minLength: 4, maxLength: 6, unit: 'grapheme-ascii' }),
      fc.constantFrom('123', '12A', 'A1B'),
    );
    fc.assert(
      fc.property(validExpense, badCurrency, (input, bad) => {
        try {
          Expense.create({ ...input, currency: bad });
          throw new Error('expected throw');
        } catch (err) {
          expect(err).toBeInstanceOf(ValidationError);
          expect((err as ValidationError).code).toBe('INVALID_CURRENCY');
        }
      }),
    );
  });

  it('P5: any splitShare whose sum is outside ±0.0001 of 1.0 → INVALID_SPLIT', () => {
    // Generate a valid split, then nudge ONE share by >0.001 so the
    // sum drifts beyond tolerance. Stays in the per-share (0,1] range.
    fc.assert(
      fc.property(validExpense, fc.double({ min: 0.01, max: 0.4, noNaN: true }), (input, drift) => {
        const ids = Object.keys(input.splitShare);
        if (ids.length === 0) return; // never; safety
        const firstId = ids[0]!;
        const firstShare = input.splitShare[firstId]!;
        const nudged = firstShare - drift;
        if (nudged <= 0 || nudged > 1) return; // skip out-of-range nudges
        const splitShare: Record<string, number> = { ...input.splitShare, [firstId]: nudged };
        try {
          Expense.create({ ...input, splitShare });
          throw new Error('expected throw');
        } catch (err) {
          expect(err).toBeInstanceOf(ValidationError);
          expect((err as ValidationError).code).toBe('INVALID_SPLIT');
        }
      }),
    );
  });

  it('P6: payer not in splitShare → INVALID_SPLIT', () => {
    const outsiderId = fc
      .string({ minLength: 8, maxLength: 32, unit: 'grapheme-ascii' })
      .filter((s) => s.trim().length > 0);
    fc.assert(
      fc.property(validExpense, outsiderId, (input, outsider) => {
        // Skip when by-accident the outsider IS in the split.
        if (input.splitShare[outsider] !== undefined) return;
        try {
          Expense.create({ ...input, paidById: outsider });
          throw new Error('expected throw');
        } catch (err) {
          expect(err).toBeInstanceOf(ValidationError);
          expect((err as ValidationError).code).toBe('INVALID_SPLIT');
        }
      }),
    );
  });
});
