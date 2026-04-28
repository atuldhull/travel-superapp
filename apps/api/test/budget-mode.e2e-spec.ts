/**
 * V.UX.16 — budget-backpacker persona. Covers:
 *
 *   PATCH /api/v1/account/preferences   (budgetMode + dailyBudgetUsd)
 *   POST  /api/v1/events/search         (freeOnly)
 *   POST  /api/v1/stays/search          (stayType, maxPriceUsdPerNight)
 *
 * Mock event provider has 4 fixtures: jazz-night ($15-25), farmers-
 * market (no price), art-opening ($0), symphony ($45-180). Free-only
 * keeps the market + art-opening, drops jazz + symphony.
 *
 * Mock stay provider has 3 fixtures tagged 'boutique' / 'inn' /
 * 'hostel'. stayType=hostel keeps just the hostel; maxPriceUsdPerNight
 * caps drop the high-tier listings.
 *
 * Installed by prompt [V.UX.16].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';

const TEST_PREFIX = 'budget-mode-e2e';

interface PrefsResp {
  readonly budgetMode: boolean;
  readonly dailyBudgetUsd: string | null;
}

interface EventResp {
  readonly title: string;
  readonly priceMin: string | null;
}

interface StayResp {
  readonly name: string;
  readonly stayType: string;
  readonly priceUsdPerNight: number | null;
}

describe('Budget mode + free events + stayType (V.UX.16 — integration)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let infraReachable = true;

  // Suite-local coords clear of every other suite.
  const lat = 34.111;
  const lng = -118.222;

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
      console.warn(`budget-mode test: infra not reachable (${message}). Skipping.`);
      infraReachable = false;
    }
  });

  afterEach(async () => {
    if (!infraReachable) return;
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
  });

  afterAll(async () => {
    if (infraReachable) await app.close();
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

  it('PATCH /preferences { budgetMode, dailyBudgetUsd } round-trips', async () => {
    if (!infraReachable) return;
    const { accessToken } = await registerUser('upsert');
    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/v1/account/preferences',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { budgetMode: true, dailyBudgetUsd: '50.00' },
    });
    expect(patch.statusCode).toBe(200);
    const body = JSON.parse(patch.body) as PrefsResp;
    expect(body.budgetMode).toBe(true);
    expect(body.dailyBudgetUsd).toBe('50.00');

    // Re-read echoes.
    const get = await app.inject({
      method: 'GET',
      url: '/api/v1/account/preferences',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const after = JSON.parse(get.body) as PrefsResp;
    expect(after.budgetMode).toBe(true);
    expect(after.dailyBudgetUsd).toBe('50.00');
  });

  it('PATCH dailyBudgetUsd null clears the target', async () => {
    if (!infraReachable) return;
    const { accessToken } = await registerUser('clear');
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/account/preferences',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { dailyBudgetUsd: '50.00' },
    });
    const clear = await app.inject({
      method: 'PATCH',
      url: '/api/v1/account/preferences',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { dailyBudgetUsd: null },
    });
    expect(clear.statusCode).toBe(200);
    expect(JSON.parse(clear.body).dailyBudgetUsd).toBeNull();
  });

  it('events freeOnly drops paid jazz + symphony', async () => {
    if (!infraReachable) return;
    const { accessToken } = await registerUser('events');
    const from = new Date('2026-06-01T00:00:00.000Z').toISOString();
    const to = new Date('2026-06-03T00:00:00.000Z').toISOString();

    const all = await app.inject({
      method: 'POST',
      url: '/api/v1/events/search',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { center: { lat, lng }, radiusKm: 10, from, to },
    });
    expect(all.statusCode).toBe(200);
    const allBody = JSON.parse(all.body) as { events: EventResp[] };
    expect(allBody.events.length).toBeGreaterThanOrEqual(3);

    const free = await app.inject({
      method: 'POST',
      url: '/api/v1/events/search',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { center: { lat, lng }, radiusKm: 10, from, to, freeOnly: true },
    });
    expect(free.statusCode).toBe(200);
    const freeBody = JSON.parse(free.body) as { events: EventResp[] };
    const titles = freeBody.events.map((e) => e.title);
    // Jazz + symphony explicitly priced — should be dropped.
    expect(titles).not.toContain('Live Jazz at The Cellar');
    expect(titles).not.toContain('City Symphony: Mahler 5');
    // At least one of the free fixtures must remain (market or
    // art-opening) — we don't assert exact count to stay tolerant
    // of fixture additions.
    expect(freeBody.events.length).toBeGreaterThan(0);
    // Every kept event has priceMin null or '0.00'.
    for (const e of freeBody.events) {
      const isFree = e.priceMin === null || Number(e.priceMin) === 0;
      expect(isFree).toBe(true);
    }
  });

  it('stays stayType=hostel keeps just the hostel fixture', async () => {
    if (!infraReachable) return;
    const { accessToken } = await registerUser('hostel');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/stays/search',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        center: { lat, lng },
        radiusKm: 10,
        checkIn: '2026-06-01',
        checkOut: '2026-06-03',
        stayType: 'hostel',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { stays: StayResp[] };
    expect(body.stays).toHaveLength(1);
    expect(body.stays[0]!.stayType).toBe('hostel');
  });

  it('stays maxPriceUsdPerNight caps drop the boutique fixture', async () => {
    if (!infraReachable) return;
    const { accessToken } = await registerUser('cap');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/stays/search',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        center: { lat, lng },
        radiusKm: 10,
        checkIn: '2026-06-01',
        checkOut: '2026-06-03',
        // Boutique = $190+ per night; under $100 should drop it.
        maxPriceUsdPerNight: 100,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { stays: StayResp[] };
    const types = body.stays.map((s) => s.stayType);
    expect(types).not.toContain('boutique');
  });
});
