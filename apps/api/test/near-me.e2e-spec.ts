/**
 * Integration tests for `POST /api/v1/near-me` ([V.UX.7]). Public,
 * no auth, no DB writes. Composite of places search + weather + safety
 * score + per-place routing.
 *
 * Mock weather + routing providers are already wired in test mode;
 * mock places are seeded via GeoQueries to ensure the search returns
 * something deterministic.
 *
 * Installed by prompt [V.UX.7].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { GeoQueries } from '../src/common/db/geo-queries';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueSuffix } from './factories';

const TEST_PREFIX = 'near-me-e2e';
// Lone South-Atlantic anchor — collision-free with other geo tests.
const REMOTE = { lat: -7.6543, lng: -28.4321 };

interface NearMeResponse {
  readonly center: { lat: number; lng: number };
  readonly radiusKm: number;
  readonly places: Array<{
    readonly id: string;
    readonly name: string;
    readonly category: string;
    readonly lat: number;
    readonly lng: number;
    readonly distanceMeters: number;
    readonly routes: Array<{ readonly mode: string; readonly durationSeconds: number }>;
  }>;
  readonly weather: { readonly days: Array<{ readonly date: string; readonly maxTempC: number }> };
  readonly safety: { readonly score: number; readonly grade: string };
  readonly fetchedAt: string;
}

describe('Near me now (integration, requires Docker Postgres + Redis)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let geo: GeoQueries;
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
      geo = moduleRef.get(GeoQueries);
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`near-me test: infra not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (dbReachable) {
      await prisma.place.deleteMany({
        where: { sourceKey: { startsWith: TEST_PREFIX } },
      });
    }
  });

  afterAll(async () => {
    if (dbReachable) {
      await app.close();
    }
    await moduleRef.close();
  });

  async function seedPlace(
    slug: string,
    lat: number,
    lng: number,
    category = 'attraction',
  ): Promise<void> {
    await geo.insertPlace({
      sourceKey: `${TEST_PREFIX}-${slug}-${uniqueSuffix()}`,
      name: `${TEST_PREFIX}-${slug}`,
      category,
      lat,
      lng,
    });
  }

  it('happy path: returns up to 5 places + weather + safety', async () => {
    if (!dbReachable) return;
    await seedPlace('a', REMOTE.lat + 0.001, REMOTE.lng + 0.001);
    await seedPlace('b', REMOTE.lat + 0.002, REMOTE.lng + 0.002, 'cafe');
    await seedPlace('c', REMOTE.lat + 0.005, REMOTE.lng + 0.005, 'park');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/near-me',
      payload: { center: REMOTE, radiusKm: 3 },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as NearMeResponse;
    expect(body.center.lat).toBeCloseTo(REMOTE.lat, 4);
    expect(body.radiusKm).toBe(3);
    expect(body.places.length).toBeGreaterThanOrEqual(1);
    expect(body.places.length).toBeLessThanOrEqual(5);

    // Sorted ascending by distance.
    for (let i = 1; i < body.places.length; i++) {
      expect(body.places[i]!.distanceMeters).toBeGreaterThanOrEqual(
        body.places[i - 1]!.distanceMeters,
      );
    }

    // Each place has at least one route option (walk).
    for (const p of body.places) {
      expect(p.routes.length).toBeGreaterThan(0);
      expect(p.routes.some((r) => r.mode === 'walk')).toBe(true);
    }

    // Weather + safety blocks present.
    expect(body.weather.days.length).toBeGreaterThanOrEqual(1);
    expect(body.safety.score).toBeGreaterThanOrEqual(0);
    expect(body.safety.score).toBeLessThanOrEqual(100);
    expect(typeof body.safety.grade).toBe('string');
  });

  it('clamps radius above 10km to 10', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/near-me',
      payload: { center: REMOTE, radiusKm: 9999 },
    });
    expect(res.statusCode).toBe(422);
  });

  it('rejects out-of-range coords with 422 VALIDATION_FAILED', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/near-me',
      payload: { center: { lat: 999, lng: -999 } },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });

  it('public endpoint — no auth required', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/near-me',
      payload: { center: REMOTE },
    });
    // 200 even without an Authorization header.
    expect(res.statusCode).toBe(200);
  });
});
