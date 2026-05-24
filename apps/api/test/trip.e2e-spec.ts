/**
 * Integration tests for the Trip module ([IV.18.2.3]).
 *
 * Full-stack exercise: guard chain (JwtAuth + Roles) → Zod pipe →
 * CreateTripDraftUseCase → PrismaTripRepository → GeoQueries raw
 * SQL on the PostGIS `center` column. Skips cleanly when Postgres
 * isn't reachable.
 *
 * Verifies:
 *   1. POST /trips without a bearer → 401 UNAUTHENTICATED.
 *   2. POST /trips with a valid bearer + clean body → 201, new row
 *      exists in DB, center is a valid PostGIS point.
 *   3. Radius > 500 → 422 INVALID_RADIUS from the use-case.
 *   4. Negative / zero radius → 422 (Zod `.positive()` trips first
 *      on 0 + negatives; we assert the filter maps either).
 *   5. GET /trips lists my own trips only (no IDOR across users).
 *   6. GET /trips/:id of another user's trip → 404 TRIP_NOT_FOUND.
 *
 * Installed by prompt [IV.18.2.3].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'trip-e2e';

describe('Trip module (integration, requires Docker Postgres)', () => {
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
    // `app.init()` triggers PrismaService.onModuleInit → $connect. If
    // Postgres is down in the dev/CI env, surface that as a skip rather
    // than a crashed suite — the same pattern GeoQueries / identity
    // tests follow once they reach the $queryRaw probe.
    try {
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
      prisma = moduleRef.get(PrismaService);
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`trip test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (!dbReachable) return;
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
  });

  afterAll(async () => {
    if (dbReachable) {
      await app.close();
    }
    await moduleRef.close();
  });

  async function registerUser(suffix: string): Promise<{
    userId: string;
    accessToken: string;
  }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail(`${TEST_PREFIX}-${suffix}`),
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-${suffix}`,
      },
      headers: { 'user-agent': 'trip-ua' },
    });
    expect(res.statusCode).toBe(201);
    const { userId, accessToken } = JSON.parse(res.body) as {
      userId: string;
      accessToken: string;
    };
    return { userId, accessToken };
  }

  const VICTORIA = { lat: 51.4952, lng: -0.1441 };

  it('POST /trips without a bearer → 401 UNAUTHENTICATED', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      payload: { title: 'London weekend', center: VICTORIA, radiusKm: 5 },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('POST /trips creates a draft row with PostGIS center populated', async () => {
    if (!dbReachable) return;
    const { userId, accessToken } = await registerUser('create');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: 'London weekend',
        center: VICTORIA,
        radiusKm: 5,
        startsOn: '2026-08-01',
        endsOn: '2026-08-03',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as {
      id: string;
      userId: string;
      title: string;
      status: string;
      radiusKm: number;
    };
    expect(body.userId).toBe(userId);
    expect(body.title).toBe('London weekend');
    expect(body.status).toBe('draft');
    expect(body.radiusKm).toBe(5);

    // Verify the Trip row exists + `center` is a valid PostGIS point.
    const row = await prisma.trip.findUnique({ where: { id: body.id } });
    expect(row).not.toBeNull();
    const centerRow = await prisma.$queryRaw<{ lng: number; lat: number }[]>`
      SELECT ST_X(center::geometry) AS lng, ST_Y(center::geometry) AS lat
      FROM "Trip" WHERE id = ${body.id}
    `;
    expect(centerRow[0]!.lat).toBeCloseTo(VICTORIA.lat, 4);
    expect(centerRow[0]!.lng).toBeCloseTo(VICTORIA.lng, 4);
  });

  it('radius > 500 km → 422 INVALID_RADIUS', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('radius-big');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { title: 'too big', center: VICTORIA, radiusKm: 501 },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('INVALID_RADIUS');
  });

  it('radius <= 0 → 422 from Zod (VALIDATION_FAILED on zero, positive check)', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('radius-zero');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { title: 'zero', center: VICTORIA, radiusKm: 0 },
    });
    expect(res.statusCode).toBe(422);
    // Either the pipe rejects (VALIDATION_FAILED) or the use-case
    // rejects (INVALID_RADIUS) — both are correct behaviour.
    const code = JSON.parse(res.body).code as string;
    expect(['VALIDATION_FAILED', 'INVALID_RADIUS']).toContain(code);
  });

  it('startsOn > endsOn → 422 INVALID_DATE_RANGE', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('bad-range');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: 'backwards',
        center: VICTORIA,
        radiusKm: 5,
        startsOn: '2026-08-10',
        endsOn: '2026-08-01',
      },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('INVALID_DATE_RANGE');
  });

  it('GET /trips lists only my own trips (no cross-user leak)', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');

    await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { title: 'alice-trip', center: VICTORIA, radiusKm: 3 },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: { title: 'bob-trip', center: VICTORIA, radiusKm: 4 },
    });

    const aliceList = await app.inject({
      method: 'GET',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(aliceList.statusCode).toBe(200);
    const trips = (JSON.parse(aliceList.body) as { trips: Array<{ title: string }> }).trips;
    expect(trips.length).toBe(1);
    expect(trips[0]!.title).toBe('alice-trip');
  });

  it("GET /trips/:id of another user's trip → 404 TRIP_NOT_FOUND (IDOR defence)", async () => {
    if (!dbReachable) return;
    const alice = await registerUser('a-idor');
    const bob = await registerUser('b-idor');

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { title: 'alice private', center: VICTORIA, radiusKm: 3 },
    });
    expect(created.statusCode).toBe(201);
    const tripId = (JSON.parse(created.body) as { id: string }).id;

    // Alice can read her own.
    const ownRead = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${tripId}`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(ownRead.statusCode).toBe(200);

    // Bob tries to read alice's — 404, not 403 (don't leak existence).
    const crossRead = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${tripId}`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(crossRead.statusCode).toBe(404);
    expect(JSON.parse(crossRead.body).code).toBe('TRIP_NOT_FOUND');
  });
});
