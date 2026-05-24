/**
 * V.UX.30 — integration tests for the trip archive + auto-archive
 * sweep + suggestions + welcome-back signal.
 *
 *   1. POST /trips/:id/archive without bearer → 401.
 *   2. Archive → 200, archivedAt non-null, default list omits the row,
 *      ?archived=true returns it. Unarchive flips it back.
 *   3. Archive of a non-owner trip → 404 TRIP_NOT_FOUND (IDOR-safe).
 *   4. AutoArchiveOldTripsUseCase stamps `archivedAt` on every trip
 *      whose createdAt is past the 365-day cutoff and leaves recent
 *      trips alone.
 *   5. GET /trips/suggestions returns 3 entries even when the user has
 *      no past trips (anchor=null path).
 *   6. /auth/me returns previousSeenAt that advances after a >1h gap.
 *
 * Installed by prompt [V.UX.30].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { AutoArchiveOldTripsUseCase } from '../src/modules/trip/application/auto-archive-old-trips.use-case';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'trip-archive-e2e';

interface RegisterRes {
  userId: string;
  accessToken: string;
}
interface TripDto {
  id: string;
  title: string;
  archivedAt: string | null;
}
interface ListRes {
  trips: TripDto[];
}
interface SuggestionsRes {
  suggestions: Array<{ destination: string; countryCode: string; anchor: string | null }>;
}

describe('V.UX.30 trip archive + suggestions + welcome-back (integration, requires Docker Postgres)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let autoArchive: AutoArchiveOldTripsUseCase;
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
      autoArchive = moduleRef.get(AutoArchiveOldTripsUseCase);
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`trip-archive test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    await prisma.trip.deleteMany({
      where: { user: { displayName: { startsWith: TEST_PREFIX } } },
    });
    await prisma.user.deleteMany({ where: { displayName: { startsWith: TEST_PREFIX } } });
  });

  afterAll(async () => {
    if (dbReachable) await app.close();
    await moduleRef.close();
  });

  async function registerAndGetToken(suffix: string): Promise<RegisterRes> {
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
    return JSON.parse(res.body) as RegisterRes;
  }

  async function createTrip(token: string, title: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title,
        center: { lat: 12.9716, lng: 77.5946 },
        radiusKm: 25,
      },
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { id: string }).id;
  }

  it('POST /trips/:id/archive without bearer → 401', async () => {
    const u = await registerAndGetToken('archive-anon');
    const id = await createTrip(u.accessToken, `${TEST_PREFIX}-anon`);
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${id}/archive`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('Archive removes from default list; ?archived=true returns it; Unarchive flips back', async () => {
    const u = await registerAndGetToken('archive-happy');
    const id = await createTrip(u.accessToken, `${TEST_PREFIX}-happy`);

    const archive = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${id}/archive`,
      headers: { authorization: `Bearer ${u.accessToken}` },
    });
    expect(archive.statusCode).toBe(200);
    expect((JSON.parse(archive.body) as TripDto).archivedAt).not.toBeNull();

    const active = await app.inject({
      method: 'GET',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${u.accessToken}` },
    });
    expect((JSON.parse(active.body) as ListRes).trips.find((t) => t.id === id)).toBeUndefined();

    const archived = await app.inject({
      method: 'GET',
      url: '/api/v1/trips?archived=true',
      headers: { authorization: `Bearer ${u.accessToken}` },
    });
    expect((JSON.parse(archived.body) as ListRes).trips.find((t) => t.id === id)).toBeDefined();

    const unarchive = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${id}/unarchive`,
      headers: { authorization: `Bearer ${u.accessToken}` },
    });
    expect(unarchive.statusCode).toBe(200);
    expect((JSON.parse(unarchive.body) as TripDto).archivedAt).toBeNull();
  });

  it('Cross-user archive → 404 TRIP_NOT_FOUND', async () => {
    const owner = await registerAndGetToken('owner');
    const stranger = await registerAndGetToken('stranger');
    const id = await createTrip(owner.accessToken, `${TEST_PREFIX}-cross`);
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${id}/archive`,
      headers: { authorization: `Bearer ${stranger.accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('TRIP_NOT_FOUND');
  });

  it('Auto-archive sweep stamps trips older than 365 days, leaves recent ones', async () => {
    const u = await registerAndGetToken('sweep');
    const oldId = await createTrip(u.accessToken, `${TEST_PREFIX}-old`);
    const recentId = await createTrip(u.accessToken, `${TEST_PREFIX}-recent`);
    // Backdate one trip past the 365-day cutoff.
    const longAgo = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    await prisma.trip.update({ where: { id: oldId }, data: { createdAt: longAgo } });

    const result = await autoArchive.execute();
    expect(result.archived).toBeGreaterThanOrEqual(1);

    const oldRow = await prisma.trip.findUnique({ where: { id: oldId } });
    const recentRow = await prisma.trip.findUnique({ where: { id: recentId } });
    expect(oldRow?.archivedAt).not.toBeNull();
    expect(recentRow?.archivedAt).toBeNull();
  });

  it('GET /trips/suggestions returns 3 entries (anchor=null when no history)', async () => {
    const u = await registerAndGetToken('suggest');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/trips/suggestions',
      headers: { authorization: `Bearer ${u.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as SuggestionsRes;
    expect(body.suggestions.length).toBe(3);
    for (const s of body.suggestions) {
      expect(s.destination).toBeTruthy();
      expect(s.anchor).toBeNull();
    }
  });

  it('/auth/me advances previousSeenAt after a >1h gap', async () => {
    const u = await registerAndGetToken('seen');
    // First /auth/me — establishes lastSeenAt; previousSeenAt still null.
    const first = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${u.accessToken}` },
    });
    expect(first.statusCode).toBe(200);
    expect(JSON.parse(first.body).previousSeenAt).toBeNull();

    // Wait for the fire-and-forget stampSeen to land.
    await new Promise((r) => setTimeout(r, 100));

    // Backdate lastSeenAt by 2 hours so the next /auth/me advances
    // previousSeenAt (the `> 1h` gap gate fires).
    await prisma.user.update({
      where: { id: u.userId },
      data: { lastSeenAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    });

    const second = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${u.accessToken}` },
    });
    expect(second.statusCode).toBe(200);
    // previousSeenAt now reflects the backdated lastSeenAt — non-null.
    expect(JSON.parse(second.body).previousSeenAt).not.toBeNull();
  });
});
