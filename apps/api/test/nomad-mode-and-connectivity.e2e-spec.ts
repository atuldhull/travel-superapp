/**
 * Integration tests for the V.UX.23 digital-nomad surfaces:
 *   - PATCH /api/v1/account/preferences with nomadMode=true round-trips
 *     the field through the synthetic-default + DB-row read paths.
 *   - POST /api/v1/stays/search with stayType=monthly returns only the
 *     V.UX.23 nomad-loft fixture.
 *   - POST /api/v1/stays/search with minWifiSpeedMbps drops listings
 *     below the floor + listings whose wifi speed is unknown.
 *   - GET /api/v1/connectivity/:countryCode is public; returns a
 *     seeded country and 404s on unseeded.
 *
 * Uses the real `MockStayProvider` so the V.UX.23 fixture changes
 * are exercised end-to-end. Redis cache for stays is flushed in
 * beforeAll so the suite-local coord doesn't pick up an old shape
 * cached by another suite.
 *
 * Installed by prompt [V.UX.23].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import Redis from 'ioredis';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'nomad-mode-e2e';
// Suite-local remote coord — outside any other suite's PostGIS rows.
const COORD = { lat: 41.1234, lng: -8.6543 };

interface StayRow {
  externalId: string;
  name: string;
  stayType: string;
  wifiSpeedMbps: number | null;
  priceUsdPerNight: number | null;
}
interface StaysResponse {
  stays: StayRow[];
}
interface PrefsResponse {
  nomadMode: boolean;
}
interface ConnectivityResponse {
  countryCode: string;
  countryName: string;
  avgMobileDownloadMbps: number;
  bestCarrier: string;
  powerPlugs: string[];
}

describe('V.UX.23 nomad mode + connectivity (integration, requires Docker Postgres + Redis)', () => {
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

      // Drop stays cache so the new V.UX.23 fixture (shape + monthly
      // entry) isn't masked by a stale entry from another suite at
      // the same coord rounding.
      const flush = new Redis(process.env['REDIS_URL']!, {
        lazyConnect: false,
        maxRetriesPerRequest: 2,
      });
      try {
        const stream = flush.scanStream({
          match: `travel-${process.env['NODE_ENV']}:stays:*`,
          count: 100,
        });
        for await (const keys of stream as unknown as AsyncIterable<string[]>) {
          if (keys.length > 0) await flush.del(...keys);
        }
      } finally {
        await flush.quit();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`nomad-mode test: infra not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { displayName: { startsWith: TEST_PREFIX } } });
  });

  afterAll(async () => {
    if (dbReachable) await app.close();
    await moduleRef.close();
  });

  async function registerAndGetToken(suffix: string): Promise<string> {
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
    return (JSON.parse(res.body) as { accessToken: string }).accessToken;
  }

  it('PATCH /account/preferences nomadMode=true round-trips on subsequent GETs', async () => {
    const token = await registerAndGetToken('prefs');

    // First GET returns the synthetic default shape with nomadMode=false.
    const initial = await app.inject({
      method: 'GET',
      url: '/api/v1/account/preferences',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(initial.statusCode).toBe(200);
    expect((JSON.parse(initial.body) as PrefsResponse).nomadMode).toBe(false);

    // PATCH flips it on.
    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/v1/account/preferences',
      headers: { authorization: `Bearer ${token}` },
      payload: { nomadMode: true },
    });
    expect(patch.statusCode).toBe(200);
    expect((JSON.parse(patch.body) as PrefsResponse).nomadMode).toBe(true);

    // Subsequent GET reads from the persisted row.
    const after = await app.inject({
      method: 'GET',
      url: '/api/v1/account/preferences',
      headers: { authorization: `Bearer ${token}` },
    });
    expect((JSON.parse(after.body) as PrefsResponse).nomadMode).toBe(true);
  });

  it('POST /stays/search with stayType=monthly returns only the nomad-loft fixture', async () => {
    const token = await registerAndGetToken('stay-monthly');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/stays/search',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        center: COORD,
        radiusKm: 5,
        checkIn: '2026-09-01',
        checkOut: '2026-09-29',
        stayType: 'monthly',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as StaysResponse;
    expect(body.stays.length).toBe(1);
    expect(body.stays[0]!.stayType).toBe('monthly');
    expect(body.stays[0]!.wifiSpeedMbps).toBe(200);
  });

  it('POST /stays/search with minWifiSpeedMbps=100 drops slow + unknown wifi listings', async () => {
    const token = await registerAndGetToken('stay-wifi');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/stays/search',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        center: COORD,
        radiusKm: 10,
        checkIn: '2026-09-01',
        checkOut: '2026-09-08',
        minWifiSpeedMbps: 100,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as StaysResponse;
    // Only the boutique (120 Mbps) and nomad-loft (200 Mbps) should pass.
    expect(body.stays.length).toBe(2);
    for (const s of body.stays) {
      expect(s.wifiSpeedMbps).not.toBeNull();
      expect(s.wifiSpeedMbps!).toBeGreaterThanOrEqual(100);
    }
  });

  it('POST /stays/search accepts a 60-night long-stay window (V.UX.23 cap bumped from 30)', async () => {
    const token = await registerAndGetToken('stay-long');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/stays/search',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        center: COORD,
        radiusKm: 5,
        checkIn: '2026-09-01',
        checkOut: '2026-10-31', // 60 nights
      },
    });
    expect(res.statusCode).toBe(200);
  });

  it('GET /connectivity/:countryCode is public, case-insensitive, and returns the seed', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/connectivity/PT',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as ConnectivityResponse;
    expect(body.countryCode).toBe('pt');
    expect(body.countryName).toBe('Portugal');
    expect(body.bestCarrier).toBe('MEO');
    expect(body.avgMobileDownloadMbps).toBeGreaterThan(0);
    expect(body.powerPlugs).toContain('C');
  });

  it('GET /connectivity/:countryCode 404s on unseeded countries', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/connectivity/zz',
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('CONNECTIVITY_INFO_NOT_FOUND');
  });
});
