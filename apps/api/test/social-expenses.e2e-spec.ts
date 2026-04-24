/**
 * Integration tests for the Social Expense split ([IV.18.12.4]).
 *
 *   POST   /trips/:tripId/expenses                 record expense
 *   GET    /trips/:tripId/expenses                 list (default 50, cap 500)
 *   GET    /trips/:tripId/expenses/balances        per-user net ledger
 *   DELETE /trips/:tripId/expenses/:id             payer-only delete
 *
 * Same collaborative-voting gate as [IV.18.12.3]: caller owns
 * the trip OR trip has an active share.
 *
 * Installed by prompt [IV.18.12.4].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';

const TEST_PREFIX = 'social-expenses-e2e';
const CENTER = { lat: 17.8901, lng: -155.6789 };

interface ExpenseResp {
  readonly id: string;
  readonly paidById: string;
  readonly amountUsd: string;
  readonly currency: string;
  readonly splitShare: Record<string, number>;
}
interface BalanceResp {
  readonly userId: string;
  readonly netUsd: string;
}

describe('Social expenses (integration, requires Postgres)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let dbReachable = true;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await app.register(fastifyCookie);
    try {
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
      prisma = moduleRef.get(PrismaService);
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`expenses test: infra not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (!dbReachable) return;
    // User cascade-deletes Trip + Expense + TripShare rows.
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
  });

  afterAll(async () => {
    if (dbReachable) await app.close();
    await moduleRef.close();
  });

  async function registerUser(suffix: string): Promise<{ userId: string; accessToken: string }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `${TEST_PREFIX}-${suffix}-${Date.now()}@example.com`,
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-${suffix}`,
      },
    });
    expect(res.statusCode).toBe(201);
    return JSON.parse(res.body) as { userId: string; accessToken: string };
  }

  async function createTrip(token: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: `${TEST_PREFIX}-trip`,
        center: CENTER,
        radiusKm: 5,
      },
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { id: string }).id;
  }

  async function mintShare(token: string, tripId: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/share`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { shareCode: string }).shareCode;
  }

  it('POST /trips/:tripId/expenses without a bearer → 401', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips/some-trip/expenses',
      payload: {
        amountUsd: '10.00',
        currency: 'USD',
        splitShare: { alice: 1.0 },
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('owner records an expense; list + balances reflect the 2-way split', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('owner');
    const bob = await registerUser('collab');
    const tripId = await createTrip(alice.accessToken);
    await mintShare(alice.accessToken, tripId);

    // Alice paid $40, split 50/50 with Bob.
    const create = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/expenses`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: {
        amountUsd: '40.00',
        currency: 'USD',
        note: 'dinner',
        splitShare: { [alice.userId]: 0.5, [bob.userId]: 0.5 },
      },
    });
    expect(create.statusCode).toBe(201);
    const exp = JSON.parse(create.body) as ExpenseResp;
    expect(exp.amountUsd).toBe('40.00');
    expect(exp.paidById).toBe(alice.userId);

    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${tripId}/expenses`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    const listBody = JSON.parse(list.body) as { expenses: ExpenseResp[] };
    expect(listBody.expenses).toHaveLength(1);
    expect(listBody.expenses[0]!.id).toBe(exp.id);

    const bal = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${tripId}/expenses/balances`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    const balBody = JSON.parse(bal.body) as { balances: BalanceResp[] };
    // Alice paid 40, owes 20 → net +20. Bob paid 0, owes 20 → net -20.
    const aliceNet = balBody.balances.find((b) => b.userId === alice.userId)!;
    const bobNet = balBody.balances.find((b) => b.userId === bob.userId)!;
    expect(aliceNet.netUsd).toBe('20.00');
    expect(bobNet.netUsd).toBe('-20.00');
  });

  it('three-way unequal split produces exact balances', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('a3');
    const bob = await registerUser('b3');
    const carol = await registerUser('c3');
    const tripId = await createTrip(alice.accessToken);
    await mintShare(alice.accessToken, tripId);

    // Alice paid $100. Split: Alice 0.4, Bob 0.3, Carol 0.3.
    await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/expenses`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: {
        amountUsd: '100.00',
        currency: 'USD',
        splitShare: { [alice.userId]: 0.4, [bob.userId]: 0.3, [carol.userId]: 0.3 },
      },
    });

    const bal = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${tripId}/expenses/balances`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    const balBody = JSON.parse(bal.body) as { balances: BalanceResp[] };
    const find = (u: string): number =>
      Number(balBody.balances.find((b) => b.userId === u)!.netUsd);
    // Alice paid 100, owes 40 → +60.
    // Bob owes 30 → -30. Carol owes 30 → -30. Sum = 0.
    expect(find(alice.userId)).toBe(60);
    expect(find(bob.userId)).toBe(-30);
    expect(find(carol.userId)).toBe(-30);
  });

  it('non-owner with no share → 404 (auth gate)', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('a-closed');
    const stranger = await registerUser('s-closed');
    const tripId = await createTrip(alice.accessToken);
    // No share minted.

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/expenses`,
      headers: { authorization: `Bearer ${stranger.accessToken}` },
      payload: {
        amountUsd: '10.00',
        currency: 'USD',
        splitShare: { [stranger.userId]: 1.0 },
      },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('TRIP_NOT_FOUND');
  });

  it('non-payer cannot delete someone else’s expense → 404 EXPENSE_NOT_FOUND', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('a-del');
    const bob = await registerUser('b-del');
    const tripId = await createTrip(alice.accessToken);
    await mintShare(alice.accessToken, tripId);

    const create = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/expenses`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: {
        amountUsd: '20.00',
        currency: 'USD',
        splitShare: { [alice.userId]: 0.5, [bob.userId]: 0.5 },
      },
    });
    const expenseId = (JSON.parse(create.body) as { id: string }).id;

    // Bob (non-payer) tries to delete.
    const attempt = await app.inject({
      method: 'DELETE',
      url: `/api/v1/trips/${tripId}/expenses/${expenseId}`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(attempt.statusCode).toBe(404);
    expect(JSON.parse(attempt.body).code).toBe('EXPENSE_NOT_FOUND');

    // Alice (the payer) successfully deletes.
    const ok = await app.inject({
      method: 'DELETE',
      url: `/api/v1/trips/${tripId}/expenses/${expenseId}`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(ok.statusCode).toBe(204);

    // Balances reset to all-zero after the only expense is gone.
    const bal = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${tripId}/expenses/balances`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    const balBody = JSON.parse(bal.body) as { balances: BalanceResp[] };
    expect(balBody.balances).toEqual([]);
  });

  it('splitShare sum != 1.0 → 422 INVALID_SPLIT', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('badsum');
    const bob = await registerUser('badsum2');
    const tripId = await createTrip(alice.accessToken);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/expenses`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: {
        amountUsd: '30.00',
        currency: 'USD',
        splitShare: { [alice.userId]: 0.5, [bob.userId]: 0.4 },
      },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('INVALID_SPLIT');
  });

  it('payer missing from splitShare → 422 INVALID_SPLIT', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('nopay');
    const bob = await registerUser('nopay2');
    const tripId = await createTrip(alice.accessToken);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/expenses`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: {
        // Alice pays but isn't in the split map.
        amountUsd: '50.00',
        currency: 'USD',
        splitShare: { [bob.userId]: 1.0 },
      },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('INVALID_SPLIT');
  });

  it('invalid amount shape (letters) → 422 VALIDATION_FAILED or INVALID_AMOUNT', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('badamount');
    const tripId = await createTrip(alice.accessToken);
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/expenses`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: {
        amountUsd: 'ten dollars',
        currency: 'USD',
        splitShare: { [alice.userId]: 1.0 },
      },
    });
    expect(res.statusCode).toBe(422);
    // Zod lets the string through; the use-case rejects with INVALID_AMOUNT.
    expect(JSON.parse(res.body).code).toBe('INVALID_AMOUNT');
  });

  it('multiple expenses accumulate into a single balance ledger', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('multi-a');
    const bob = await registerUser('multi-b');
    const tripId = await createTrip(alice.accessToken);
    await mintShare(alice.accessToken, tripId);

    // Alice pays $30 dinner (split 50/50).
    await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/expenses`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: {
        amountUsd: '30.00',
        currency: 'USD',
        splitShare: { [alice.userId]: 0.5, [bob.userId]: 0.5 },
      },
    });
    // Bob pays $10 taxi (split 50/50).
    await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/expenses`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: {
        amountUsd: '10.00',
        currency: 'USD',
        splitShare: { [alice.userId]: 0.5, [bob.userId]: 0.5 },
      },
    });

    const bal = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${tripId}/expenses/balances`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    const balBody = JSON.parse(bal.body) as { balances: BalanceResp[] };
    const find = (u: string): number =>
      Number(balBody.balances.find((b) => b.userId === u)!.netUsd);
    // Alice: paid 30, owes (15+5)=20 → net +10.
    // Bob: paid 10, owes (15+5)=20 → net -10.
    expect(find(alice.userId)).toBe(10);
    expect(find(bob.userId)).toBe(-10);
  });
});
