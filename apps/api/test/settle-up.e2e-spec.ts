/**
 * Integration tests for `GET /trips/:tripId/expenses/settle-up`
 * ([V.UX.8]). Greedy minimum-cashflow transfer plan.
 *
 * Plus a unit-shaped check on the pure `computeMinimumCashflow`
 * helper for boundary cases without going through the auth gate.
 *
 * Installed by prompt [V.UX.8].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { computeMinimumCashflow } from '../src/modules/social/application/settle-up.use-case';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'settle-up-e2e';
const REMOTE = { lat: 41.7654, lng: 19.4321 };

interface TransfersBody {
  readonly transfers: Array<{
    readonly fromUserId: string;
    readonly toUserId: string;
    readonly amountUsd: string;
  }>;
}

describe('computeMinimumCashflow (pure)', () => {
  it('zero balances → no transfers', () => {
    const out = computeMinimumCashflow([
      { userId: 'a', netUsd: '0.00' },
      { userId: 'b', netUsd: '0.00' },
    ]);
    expect(out).toHaveLength(0);
  });

  it('classic 3-way: A is owed 20, B owes 12, C owes 8 → 2 transfers', () => {
    const out = computeMinimumCashflow([
      { userId: 'a', netUsd: '20.00' },
      { userId: 'b', netUsd: '-12.00' },
      { userId: 'c', netUsd: '-8.00' },
    ]);
    expect(out).toHaveLength(2);
    const total = out.reduce((s, t) => s + Number(t.amountUsd), 0);
    expect(total).toBeCloseTo(20, 2);
    // B (largest debtor) pays A first.
    expect(out[0]).toEqual({ fromUserId: 'b', toUserId: 'a', amountUsd: '12.00' });
    expect(out[1]).toEqual({ fromUserId: 'c', toUserId: 'a', amountUsd: '8.00' });
  });

  it('K non-zero users → at most K-1 transfers', () => {
    const out = computeMinimumCashflow([
      { userId: 'a', netUsd: '15.00' },
      { userId: 'b', netUsd: '5.00' },
      { userId: 'c', netUsd: '-7.00' },
      { userId: 'd', netUsd: '-13.00' },
    ]);
    expect(out.length).toBeLessThanOrEqual(3);
  });
});

describe('Trip settle-up route (integration, requires Docker Postgres + Redis)', () => {
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
      console.warn(`settle-up test: infra not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (dbReachable) {
      await prisma.user.deleteMany({
        where: { displayName: { startsWith: TEST_PREFIX } },
      });
    }
  });

  afterAll(async () => {
    if (dbReachable) {
      await app.close();
    }
    await moduleRef.close();
  });

  async function registerUser(suffix: string): Promise<{ accessToken: string; userId: string }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail(`${TEST_PREFIX}-${suffix}`),
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-${suffix}`,
      },
    });
    expect(res.statusCode).toBe(201);
    return JSON.parse(res.body) as { accessToken: string; userId: string };
  }

  it('owner with one self-paid expense → empty transfer plan (paid 100% of own share)', async () => {
    const owner = await registerUser('owner');
    const trip = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { title: 'settle', center: REMOTE, radiusKm: 5 },
    });
    expect(trip.statusCode).toBe(201);
    const tripId = (JSON.parse(trip.body) as { id: string }).id;

    const expense = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/expenses`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        amountUsd: '50.00',
        currency: 'USD',
        splitShare: { [owner.userId]: 1 },
      },
    });
    expect(expense.statusCode).toBe(201);

    const settle = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${tripId}/expenses/settle-up`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(settle.statusCode).toBe(200);
    const body = JSON.parse(settle.body) as TransfersBody;
    expect(body.transfers).toHaveLength(0);
  });

  it('non-owner-without-share → 404 TRIP_NOT_FOUND', async () => {
    const owner = await registerUser('a');
    const stranger = await registerUser('b');
    const trip = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { title: 'settle', center: REMOTE, radiusKm: 5 },
    });
    const tripId = (JSON.parse(trip.body) as { id: string }).id;

    const settle = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${tripId}/expenses/settle-up`,
      headers: { authorization: `Bearer ${stranger.accessToken}` },
    });
    expect(settle.statusCode).toBe(404);
  });
});
