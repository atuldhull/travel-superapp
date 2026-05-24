/**
 * Unit tests for `Expense.create()` — the static factory that holds
 * the seven invariants the [F4] DDD refactor lifted out of
 * `CreateExpenseUseCase`. Pure domain test: no DB, no Nest, no
 * mocks. Each test asserts ONE invariant.
 */
import { ValidationError } from '@app/errors';
import { Expense, type CreateExpenseInput } from '../src/modules/social/domain/expense.entity';

const VALID: CreateExpenseInput = {
  tripId: 'trip_1',
  paidById: 'user_alice',
  amountUsd: '30.00',
  currency: 'USD',
  note: 'Pizza',
  splitShare: { user_alice: 0.5, user_bob: 0.5 },
};

function expectInvalid(input: CreateExpenseInput, code: string): void {
  try {
    Expense.create(input);
  } catch (err) {
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).code).toBe(code);
    return;
  }
  throw new Error(`Expected Expense.create() to throw ${code}, but it succeeded`);
}

describe('Expense.create() (unit — domain invariants)', () => {
  it('happy path returns the input, with currency uppercased', () => {
    const out = Expense.create({ ...VALID, currency: 'usd' });
    expect(out).toEqual({ ...VALID, currency: 'USD' });
  });

  it('I1 rejects an amount that is not a positive 2-dp decimal', () => {
    expectInvalid({ ...VALID, amountUsd: '12.345' }, 'INVALID_AMOUNT');
    expectInvalid({ ...VALID, amountUsd: '-5.00' }, 'INVALID_AMOUNT');
    expectInvalid({ ...VALID, amountUsd: 'abc' }, 'INVALID_AMOUNT');
    expectInvalid({ ...VALID, amountUsd: '' }, 'INVALID_AMOUNT');
  });

  it('I2 rejects an amount of zero or above the numeric(10,2) ceiling', () => {
    expectInvalid({ ...VALID, amountUsd: '0' }, 'INVALID_AMOUNT');
    expectInvalid({ ...VALID, amountUsd: '0.00' }, 'INVALID_AMOUNT');
    expectInvalid({ ...VALID, amountUsd: '100000000' }, 'INVALID_AMOUNT');
  });

  it('I3 rejects a currency that is not 3 letters', () => {
    expectInvalid({ ...VALID, currency: 'US' }, 'INVALID_CURRENCY');
    expectInvalid({ ...VALID, currency: 'USDA' }, 'INVALID_CURRENCY');
    expectInvalid({ ...VALID, currency: '123' }, 'INVALID_CURRENCY');
  });

  it('I4 rejects an empty splitShare', () => {
    expectInvalid({ ...VALID, splitShare: {} }, 'INVALID_SPLIT');
  });

  it('I5 rejects a share that is non-finite, ≤0, or >1', () => {
    expectInvalid({ ...VALID, splitShare: { user_alice: 0, user_bob: 1 } }, 'INVALID_SPLIT');
    expectInvalid({ ...VALID, splitShare: { user_alice: -0.1, user_bob: 1.1 } }, 'INVALID_SPLIT');
    expectInvalid(
      { ...VALID, splitShare: { user_alice: Number.NaN, user_bob: 1 } },
      'INVALID_SPLIT',
    );
    expectInvalid(
      { ...VALID, splitShare: { user_alice: 1.5, user_bob: 0.5 } as Record<string, number> },
      'INVALID_SPLIT',
    );
  });

  it('I6 rejects shares that do not sum to 1.0 (outside tolerance)', () => {
    expectInvalid({ ...VALID, splitShare: { user_alice: 0.6, user_bob: 0.5 } }, 'INVALID_SPLIT');
    expectInvalid({ ...VALID, splitShare: { user_alice: 0.4, user_bob: 0.4 } }, 'INVALID_SPLIT');
  });

  it('I6 accepts shares within ±0.0001 tolerance (rounding-safe)', () => {
    // 3-way split: 0.3333 + 0.3333 + 0.3333 = 0.9999 (sum-1 = 0.0001 OK)
    const out = Expense.create({
      ...VALID,
      splitShare: { user_alice: 0.3333, user_bob: 0.3333, user_carol: 0.3334 },
    });
    expect(out.splitShare).toEqual({
      user_alice: 0.3333,
      user_bob: 0.3333,
      user_carol: 0.3334,
    });
  });

  it('I7 rejects a splitShare that does not include the payer', () => {
    expectInvalid(
      { ...VALID, paidById: 'user_outsider', splitShare: { user_alice: 1.0 } },
      'INVALID_SPLIT',
    );
  });
});

describe('Expense.fromPersistence() (unit)', () => {
  it('round-trips a DB row into a class instance with readable fields', () => {
    const row = {
      id: 'exp_1',
      tripId: 'trip_1',
      paidById: 'user_alice',
      amountUsd: '12.50',
      currency: 'USD',
      note: 'Coffee',
      splitShare: { user_alice: 0.5, user_bob: 0.5 },
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };
    const expense = Expense.fromPersistence(row);
    expect(expense).toBeInstanceOf(Expense);
    expect(expense.id).toBe('exp_1');
    expect(expense.amountUsd).toBe('12.50');
    expect(expense.splitShare).toEqual({ user_alice: 0.5, user_bob: 0.5 });
  });
});
