/**
 * Integration tests for the admin trip moderation surface
 * ([IV.18.18.3]).
 *
 *   GET    /admin/trips?q=&status=&limit=&offset=
 *   POST   /admin/trips/:id/archive
 *   DELETE /admin/trips/:id
 *
 * Cross-user list (admin sees ALL users' trips). Archive is soft
 * (flips `status = 'archived'`); delete is hard with cascade to
 * itinerary + child rows.
 *
 * Installed by prompt [IV.18.18.3].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';

const TEST_PREFIX = 'admin-trips-e2e';
const COORD = { lat: 19.4326, lng: -99.1332 };

interface AdminTripResp {
  id: string;
  userId: string;
  title: string;
  status: string;
}

interface ListResp {
  trips: AdminTripResp[];
  total: number;
}

describe('Admin trip moderation (integration, requires Docker Postgres)', () => {
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
      console.warn(`admin-trips test: DB not reachable (${message}). Skipping.`);
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
    if (dbReachable) await app.close();
    await moduleRef.close();
  });

  async function registerUser(suffix: string): Promise<{
    userId: string;
    accessToken: string;
    email: string;
    password: string;
  }> {
    const email = `${TEST_PREFIX}-${suffix}-${Date.now()}@example.com`;
    const password = 'correct-horse-battery-staple';
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password, displayName: `${TEST_PREFIX}-${suffix}` },
    });
    expect(res.statusCode).toBe(201);
    return {
      ...(JSON.parse(res.body) as { userId: string; accessToken: string }),
      email,
      password,
    };
  }

  async function loginAsAdmin(suffix: string): Promise<string> {
    const reg = await registerUser(suffix);
    await prisma.user.update({ where: { id: reg.userId }, data: { role: 'admin' } });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: reg.email, password: reg.password },
    });
    expect(login.statusCode).toBe(200);
    return (JSON.parse(login.body) as { accessToken: string }).accessToken;
  }

  async function createTrip(token: string, title: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${token}` },
      payload: { title, center: COORD, radiusKm: 5 },
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { id: string }).id;
  }

  async function adminList(token: string, query = ''): Promise<ListResp> {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/trips${query}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    return JSON.parse(res.body) as ListResp;
  }

  it('GET /admin/trips without bearer → 401', async () => {
    if (!dbReachable) return;
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/trips' });
    expect(res.statusCode).toBe(401);
  });

  it('non-admin → 403', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('non-admin');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/trips',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('?q=substring filters by title (case-insensitive); cross-user', async () => {
    if (!dbReachable) return;
    const adminToken = await loginAsAdmin('list-admin');
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');
    await createTrip(alice.accessToken, `${TEST_PREFIX}-Sicily-Adventure`);
    await createTrip(bob.accessToken, `${TEST_PREFIX}-Boring-Trip`);

    // Case-insensitive substring on "Sicily".
    const body = await adminList(adminToken, '?q=sicily');
    expect(body.trips.length).toBeGreaterThanOrEqual(1);
    expect(body.trips.every((t) => t.title.toLowerCase().includes('sicily'))).toBe(true);
    // Verify cross-user: Alice's trip should appear in admin's list.
    expect(body.trips.some((t) => t.userId === alice.userId)).toBe(true);
  });

  it('?status=archived filters by status', async () => {
    if (!dbReachable) return;
    const adminToken = await loginAsAdmin('status-admin');
    const u = await registerUser('status-user');
    const tripId = await createTrip(u.accessToken, `${TEST_PREFIX}-status-test`);
    // Backdoor via Prisma — flip the status to archived.
    await prisma.trip.update({ where: { id: tripId }, data: { status: 'archived' } });

    const body = await adminList(adminToken, `?status=archived&q=${TEST_PREFIX}-status-test`);
    expect(body.trips.length).toBeGreaterThanOrEqual(1);
    for (const t of body.trips) expect(t.status).toBe('archived');
    expect(body.trips.some((t) => t.id === tripId)).toBe(true);
  });

  it('archive flips status; trip row + itinerary day still present (soft moderation)', async () => {
    if (!dbReachable) return;
    const adminToken = await loginAsAdmin('archive-admin');
    const u = await registerUser('archive-target');
    // Create with dates so itinerary generation succeeds and we can
    // verify archive doesn't cascade.
    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${u.accessToken}` },
      payload: {
        title: `${TEST_PREFIX}-archive-target`,
        center: COORD,
        radiusKm: 5,
        startsOn: '2026-09-01',
        endsOn: '2026-09-01',
      },
    });
    expect(tripRes.statusCode).toBe(201);
    const tripId = (JSON.parse(tripRes.body) as { id: string }).id;
    const itinRes = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/itinerary`,
      headers: { authorization: `Bearer ${u.accessToken}` },
    });
    expect(itinRes.statusCode).toBe(200);
    const beforeDays = await prisma.itineraryDay.count({ where: { tripId } });
    expect(beforeDays).toBeGreaterThanOrEqual(1);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/trips/${tripId}/archive`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(204);

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    expect(trip).not.toBeNull();
    expect(trip!.status).toBe('archived');
    // Soft moderation — children must NOT cascade.
    const afterDays = await prisma.itineraryDay.count({ where: { tripId } });
    expect(afterDays).toBe(beforeDays);
  });

  it('delete cascades: trip row + itinerary days + items wiped', async () => {
    if (!dbReachable) return;
    const adminToken = await loginAsAdmin('delete-admin');
    const u = await registerUser('delete-target');
    // Trip with dates so itinerary generation succeeds.
    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${u.accessToken}` },
      payload: {
        title: `${TEST_PREFIX}-delete-target`,
        center: COORD,
        radiusKm: 5,
        startsOn: '2026-09-01',
        endsOn: '2026-09-01',
      },
    });
    expect(tripRes.statusCode).toBe(201);
    const tripId = (JSON.parse(tripRes.body) as { id: string }).id;
    const itinRes = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/itinerary`,
      headers: { authorization: `Bearer ${u.accessToken}` },
    });
    expect(itinRes.statusCode).toBe(200);

    const beforeDays = await prisma.itineraryDay.count({ where: { tripId } });
    expect(beforeDays).toBeGreaterThanOrEqual(1);

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/trips/${tripId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(del.statusCode).toBe(204);

    // Trip + cascade verification.
    expect(await prisma.trip.findUnique({ where: { id: tripId } })).toBeNull();
    expect(await prisma.itineraryDay.count({ where: { tripId } })).toBe(0);
  });

  it('archive on missing trip → 404 TRIP_NOT_FOUND', async () => {
    if (!dbReachable) return;
    const adminToken = await loginAsAdmin('archive-404');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/trips/does-not-exist/archive',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('TRIP_NOT_FOUND');
  });

  it('delete on missing trip → 404 TRIP_NOT_FOUND', async () => {
    if (!dbReachable) return;
    const adminToken = await loginAsAdmin('delete-404');
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/admin/trips/does-not-exist',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('TRIP_NOT_FOUND');
  });

  it('unknown status param → 400 VALIDATION_FAILED', async () => {
    if (!dbReachable) return;
    const adminToken = await loginAsAdmin('bad-status');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/trips?status=bogus',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });

  it('non-admin caller can’t archive', async () => {
    if (!dbReachable) return;
    const attacker = await registerUser('attacker');
    const target = await registerUser('victim');
    const tripId = await createTrip(target.accessToken, `${TEST_PREFIX}-untouched`);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/trips/${tripId}/archive`,
      headers: { authorization: `Bearer ${attacker.accessToken}` },
    });
    expect(res.statusCode).toBe(403);

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    expect(trip!.status).not.toBe('archived');
  });
});
