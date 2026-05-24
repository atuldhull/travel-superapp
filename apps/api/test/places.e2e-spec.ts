/**
 * Integration tests for the Places module first slice ([IV.18.2.9]).
 * Drives the full guard + pipe + use-case + repo + PostGIS path.
 *
 * Covers:
 *   1. POST /places/search without bearer → 401 UNAUTHENTICATED.
 *   2. Happy path — seeded places within 5km of Victoria are
 *      returned with `distanceMeters`, ordered ascending.
 *   3. Category filter narrows the result set.
 *   4. Radius > 50km → 422 INVALID_RADIUS (use-case cap).
 *   5. Radius ≤ 0 → 422 (Zod or use-case — both valid).
 *   6. Empty radius returns empty array (not 404).
 *   7. `limit` clamps the result set.
 *
 * Uses the `GeoQueries` seed helper to isolate each test's rows by
 * `sourceKey` prefix — matches the pattern in geo-queries.e2e-spec.
 *
 * Installed by prompt [IV.18.2.9].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { GeoQueries } from '../src/common/db/geo-queries';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const SOURCE_PREFIX = 'places-e2e';
const VICTORIA = { lat: 51.4952, lng: -0.1441 };
const HYDE_PARK = { lat: 51.5073, lng: -0.1657 }; // ~2 km from Victoria
const TRAFALGAR = { lat: 51.5074, lng: -0.1278 }; // ~1.7 km
const WINDSOR = { lat: 51.4839, lng: -0.6044 }; // ~35 km

describe('Places search (integration, requires Docker Postgres)', () => {
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
      console.warn(`places test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    await prisma.place.deleteMany({
      where: { sourceKey: { startsWith: SOURCE_PREFIX } },
    });
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: SOURCE_PREFIX } },
    });
  });

  afterAll(async () => {
    if (dbReachable) {
      await app.close();
    }
    await moduleRef.close();
  });

  async function registerAndGetToken(suffix: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail(`${SOURCE_PREFIX}-${suffix}`),
        password: 'correct-horse-battery-staple',
        displayName: `${SOURCE_PREFIX}-${suffix}`,
      },
      headers: { 'user-agent': 'places-ua' },
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { accessToken: string }).accessToken;
  }

  async function seedPlaces(): Promise<void> {
    await geo.insertPlace({
      sourceKey: `${SOURCE_PREFIX}-hyde`,
      name: 'Hyde Park',
      category: 'park',
      lat: HYDE_PARK.lat,
      lng: HYDE_PARK.lng,
    });
    await geo.insertPlace({
      sourceKey: `${SOURCE_PREFIX}-trafalgar`,
      name: 'Trafalgar Square',
      category: 'landmark',
      lat: TRAFALGAR.lat,
      lng: TRAFALGAR.lng,
    });
    await geo.insertPlace({
      sourceKey: `${SOURCE_PREFIX}-windsor`,
      name: 'Windsor Castle',
      category: 'castle',
      lat: WINDSOR.lat,
      lng: WINDSOR.lng,
    });
  }

  it('POST /places/search without a bearer → 401 UNAUTHENTICATED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/places/search',
      payload: { center: VICTORIA, radiusKm: 5 },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('5km search around Victoria returns 2 places ordered by ascending distance', async () => {
    const token = await registerAndGetToken('happy');
    await seedPlaces();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/places/search',
      headers: { authorization: `Bearer ${token}` },
      payload: { center: VICTORIA, radiusKm: 5 },
    });
    expect(res.statusCode).toBe(200);
    const all = (
      JSON.parse(res.body) as {
        places: Array<{ sourceKey: string; name: string; distanceMeters: number }>;
      }
    ).places;
    // Filter to this test's own rows (other specs seed places too).
    const mine = all.filter((p) => p.sourceKey.startsWith(SOURCE_PREFIX));
    expect(mine).toHaveLength(2);
    const names = mine.map((p) => p.name);
    expect(names).toContain('Hyde Park');
    expect(names).toContain('Trafalgar Square');
    expect(names).not.toContain('Windsor Castle');
    // Trafalgar is closer than Hyde Park.
    const distances = mine.map((p) => p.distanceMeters);
    expect([...distances].sort((a, b) => a - b)).toEqual(distances);
  });

  it('category filter narrows results', async () => {
    const token = await registerAndGetToken('category');
    await seedPlaces();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/places/search',
      headers: { authorization: `Bearer ${token}` },
      payload: { center: VICTORIA, radiusKm: 5, category: 'park' },
    });
    expect(res.statusCode).toBe(200);
    const mine = (
      JSON.parse(res.body) as { places: Array<{ sourceKey: string; category: string }> }
    ).places.filter((p) => p.sourceKey.startsWith(SOURCE_PREFIX));
    expect(mine).toHaveLength(1);
    expect(mine[0]!.category).toBe('park');
  });

  it('radius > 50 km → 422 INVALID_RADIUS', async () => {
    const token = await registerAndGetToken('big-radius');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/places/search',
      headers: { authorization: `Bearer ${token}` },
      payload: { center: VICTORIA, radiusKm: 51 },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('INVALID_RADIUS');
  });

  it('radius ≤ 0 → 422 (Zod or use-case; both correct)', async () => {
    const token = await registerAndGetToken('zero-radius');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/places/search',
      headers: { authorization: `Bearer ${token}` },
      payload: { center: VICTORIA, radiusKm: 0 },
    });
    expect(res.statusCode).toBe(422);
    const code = JSON.parse(res.body).code as string;
    expect(['VALIDATION_FAILED', 'INVALID_RADIUS']).toContain(code);
  });

  it('empty radius (no seeded places nearby) returns empty array, not 404', async () => {
    const token = await registerAndGetToken('empty');
    // Nothing seeded for this test's own prefix, but there may be rows
    // from other suites. Use a remote point so we confidently get zero.
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/places/search',
      headers: { authorization: `Bearer ${token}` },
      payload: { center: { lat: -89, lng: 0 }, radiusKm: 1 },
    });
    expect(res.statusCode).toBe(200);
    expect((JSON.parse(res.body) as { places: unknown[] }).places).toEqual([]);
  });

  it('limit clamps the result set', async () => {
    const token = await registerAndGetToken('limit');
    // Seed 4 places all within 5 km of Victoria.
    for (let i = 0; i < 4; i++) {
      await geo.insertPlace({
        sourceKey: `${SOURCE_PREFIX}-limit-${i}`,
        name: `limit-${i}`,
        category: 'test',
        lat: VICTORIA.lat + i * 0.002,
        lng: VICTORIA.lng,
      });
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/places/search',
      headers: { authorization: `Bearer ${token}` },
      payload: { center: VICTORIA, radiusKm: 5, limit: 2 },
    });
    expect(res.statusCode).toBe(200);
    const all = (JSON.parse(res.body) as { places: Array<{ sourceKey: string }> }).places;
    const mine = all.filter((p) => p.sourceKey.startsWith(`${SOURCE_PREFIX}-limit-`));
    // Use-case slices after fetch — `mine` is bounded by `limit: 2`
    // relative to what the DB returned. Nearer rows win; since all
    // 4 limit-* are within 5 km, we should see at most 2 of ours.
    expect(mine.length).toBeLessThanOrEqual(2);
  });
});
