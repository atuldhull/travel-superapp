/**
 * Integration tests for `GET /api/v1/events/festivals` ([V.UX.22]).
 *
 * Uses the real `MockEventProvider` (no override) so the festival
 * fixture added in V.UX.22 is exercised end-to-end, including the
 * cache decorator and the controller's `category=festival` server-side
 * lock.
 *
 *   1. GET without bearer → 401 UNAUTHENTICATED.
 *   2. Window covering the festival → 200 with the Diwali fixture.
 *   3. Window before the festival starts → 200 empty list.
 *   4. radiusKm > 30 → 422 INVALID_RADIUS.
 *   5. to <= from → 422 INVALID_DATE_RANGE.
 *
 * Coord (-19.7654, 73.5421) is unique to this suite per
 * feedback_unique_test_coords.md.
 *
 * Installed by prompt [V.UX.22].
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

const TEST_PREFIX = 'events-festivals-e2e';
const ANCHOR = { lat: -19.7654, lng: 73.5421 };

interface FestivalBody {
  externalId: string;
  title: string;
  category: string;
  startsAt: string;
  endsAt: string;
}
interface FestivalsResponse {
  festivals: FestivalBody[];
}

describe('GET /api/v1/events/festivals (integration, requires Docker Postgres + Redis)', () => {
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

      // Drop any cached events from earlier suites so the festival
      // fixture is fetched fresh through the decorator.
      const flush = new Redis(process.env['REDIS_URL']!, {
        lazyConnect: false,
        maxRetriesPerRequest: 2,
      });
      try {
        const stream = flush.scanStream({
          match: `travel-${process.env['NODE_ENV']}:events:*`,
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
      console.warn(`events-festivals test: infra not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (!dbReachable) return;
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

  function url(params: Record<string, string | number>): string {
    const tuples: [string, string][] = Object.entries(params).map(([k, v]) => [k, String(v)]);
    const qs = new URLSearchParams(tuples).toString();
    return `/api/v1/events/festivals?${qs}`;
  }

  it('GET without bearer → 401 UNAUTHENTICATED', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'GET',
      url: url({
        lat: ANCHOR.lat,
        lng: ANCHOR.lng,
        from: '2026-09-01T00:00:00Z',
        to: '2026-09-08T00:00:00Z',
      }),
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('window covering the festival returns the Diwali fixture', async () => {
    if (!dbReachable) return;
    const token = await registerAndGetToken('hit');
    // Mock provider's diwali fixture starts at from + 24h. A 7-day
    // window from 2026-09-01 wraps it.
    const res = await app.inject({
      method: 'GET',
      url: url({
        lat: ANCHOR.lat,
        lng: ANCHOR.lng,
        from: '2026-09-01T00:00:00Z',
        to: '2026-09-08T00:00:00Z',
      }),
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as FestivalsResponse;
    expect(body.festivals.length).toBeGreaterThan(0);
    const titles = body.festivals.map((f) => f.title);
    expect(titles).toContain('Diwali Festival of Lights');
    for (const f of body.festivals) {
      expect(f.category).toBe('festival');
    }
  });

  it('two-hour window before the festival starts returns an empty list', async () => {
    if (!dbReachable) return;
    const token = await registerAndGetToken('miss');
    const res = await app.inject({
      method: 'GET',
      url: url({
        lat: ANCHOR.lat,
        lng: ANCHOR.lng,
        from: '2026-09-01T00:00:00Z',
        to: '2026-09-01T02:00:00Z',
      }),
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as FestivalsResponse;
    expect(body.festivals).toEqual([]);
  });

  it('radiusKm > 30 → 422 INVALID_RADIUS', async () => {
    if (!dbReachable) return;
    const token = await registerAndGetToken('rad');
    const res = await app.inject({
      method: 'GET',
      url: url({
        lat: ANCHOR.lat,
        lng: ANCHOR.lng,
        radiusKm: 100,
        from: '2026-09-01T00:00:00Z',
        to: '2026-09-08T00:00:00Z',
      }),
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('INVALID_RADIUS');
  });

  it('to <= from → 422 INVALID_DATE_RANGE', async () => {
    if (!dbReachable) return;
    const token = await registerAndGetToken('range');
    const res = await app.inject({
      method: 'GET',
      url: url({
        lat: ANCHOR.lat,
        lng: ANCHOR.lng,
        from: '2026-09-08T00:00:00Z',
        to: '2026-09-08T00:00:00Z',
      }),
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('INVALID_DATE_RANGE');
  });
});
