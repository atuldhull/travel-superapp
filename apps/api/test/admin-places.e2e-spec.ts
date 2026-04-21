/**
 * Integration tests for the Admin module ([IV.18.3.1]).
 *
 * Covers the full guard chain on the new surface:
 *   JwtAuthGuard → RolesGuard(@Roles('admin')) → controller →
 *   AdminCreate/DeletePlaceUseCase → PLACE_REPOSITORY (Prisma +
 *   GeoQueries for insert, deleteMany for delete).
 *
 * Admin bootstrap: there's no CLI for role promotion yet, so each
 * admin-role test registers a user, flips `role = 'admin'` in the
 * DB via `prisma.user.update`, and re-logs-in so the new JWT
 * carries the admin role (the role claim is baked into the access
 * token at issuance — see `login.use-case.ts`).
 *
 * Cross-suite Place contamination avoidance (per
 * memory/feedback_unique_test_coords.md): every Place this suite
 * creates has a `sourceKey` starting with SOURCE_PREFIX + lat/lng
 * in a mid-ocean point used by no other suite.
 *
 * Installed by prompt [IV.18.3.1].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';

const TEST_PREFIX = 'admin-e2e';
const SOURCE_PREFIX = 'admin-e2e:';
// Suite-local coord — no other e2e suite uses the (23.x, 178.x)
// quadrant, so concurrent jest workers can't race on the same Place
// rows during radius queries / FK constraints.
const REMOTE = { lat: 23.4567, lng: 178.1234 };
const PASSWORD = 'correct-horse-battery-staple';

describe('Admin module (integration, requires Docker Postgres)', () => {
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
      console.warn(`admin-places test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (!dbReachable) return;
    // Wipe any Places this suite created first (FKs cascade to any
    // itinerary items, but none should exist for this coord — still,
    // delete-by-sourceKey is the right scoping primitive).
    await prisma.place.deleteMany({ where: { sourceKey: { startsWith: SOURCE_PREFIX } } });
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
    email: string;
    accessToken: string;
  }> {
    const email = `${TEST_PREFIX}-${suffix}-${Date.now()}@example.com`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password: PASSWORD,
        displayName: `${TEST_PREFIX}-${suffix}`,
      },
      headers: { 'user-agent': 'admin-ua/1.0' },
    });
    expect(res.statusCode).toBe(201);
    const { userId, accessToken } = JSON.parse(res.body) as {
      userId: string;
      accessToken: string;
    };
    return { userId, email, accessToken };
  }

  async function promoteAndReLogin(
    userId: string,
    email: string,
  ): Promise<{ accessToken: string }> {
    await prisma.user.update({
      where: { id: userId },
      data: { role: 'admin' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: PASSWORD },
      headers: { 'user-agent': 'admin-ua/1.0' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { accessToken: string };
    return { accessToken: body.accessToken };
  }

  function placeBody(suffix: string): Record<string, unknown> {
    return {
      sourceKey: `${SOURCE_PREFIX}${suffix}-${Date.now()}`,
      name: `Admin seed ${suffix}`,
      category: 'landmark',
      lat: REMOTE.lat,
      lng: REMOTE.lng,
      address: null,
      countryCode: null,
      relaxationScore: 42,
      metadata: { seeded: true },
    };
  }

  it('POST /admin/places without a bearer → 401 UNAUTHENTICATED', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/places',
      payload: placeBody('unauth'),
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('POST /admin/places with a non-admin bearer → 403 ROLE_FORBIDDEN', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('non-admin');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/places',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: placeBody('forbidden'),
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body) as { code: string; context?: { actual?: string } };
    expect(body.code).toBe('ROLE_FORBIDDEN');
    expect(body.context?.actual).toBe('user');
  });

  it('POST /admin/places with an admin bearer → 201 + row exists in DB', async () => {
    if (!dbReachable) return;
    const { userId, email } = await registerUser('create-ok');
    const { accessToken } = await promoteAndReLogin(userId, email);
    const body = placeBody('create-ok');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/places',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: body,
    });
    expect(res.statusCode).toBe(201);
    const dto = JSON.parse(res.body) as {
      id: string;
      sourceKey: string;
      name: string;
      category: string;
      relaxationScore: number;
    };
    expect(dto.sourceKey).toBe(body['sourceKey']);
    expect(dto.name).toBe(body['name']);
    expect(dto.relaxationScore).toBe(42);

    // Row exists, and its PostGIS coord matches what we sent.
    const row = await prisma.place.findUnique({ where: { id: dto.id } });
    expect(row).not.toBeNull();
    const coordRow = await prisma.$queryRaw<{ lng: number; lat: number }[]>`
      SELECT ST_X(coordinates::geometry) AS lng, ST_Y(coordinates::geometry) AS lat
      FROM "Place" WHERE id = ${dto.id}
    `;
    expect(coordRow[0]!.lat).toBeCloseTo(REMOTE.lat, 4);
    expect(coordRow[0]!.lng).toBeCloseTo(REMOTE.lng, 4);
  });

  it('DELETE /admin/places/:id with admin bearer → 204 + row gone', async () => {
    if (!dbReachable) return;
    const { userId, email } = await registerUser('delete-ok');
    const { accessToken } = await promoteAndReLogin(userId, email);
    const body = placeBody('delete-ok');
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/places',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: body,
    });
    expect(created.statusCode).toBe(201);
    const placeId = (JSON.parse(created.body) as { id: string }).id;

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/places/${placeId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(del.statusCode).toBe(204);

    const row = await prisma.place.findUnique({ where: { id: placeId } });
    expect(row).toBeNull();
  });

  it('DELETE /admin/places/:id for a missing id → 404 PLACE_NOT_FOUND', async () => {
    if (!dbReachable) return;
    const { userId, email } = await registerUser('delete-404');
    const { accessToken } = await promoteAndReLogin(userId, email);

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/admin/places/does-not-exist-cuid',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('PLACE_NOT_FOUND');
  });

  it('DELETE /admin/places/:id with a non-admin bearer → 403 ROLE_FORBIDDEN', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('delete-403');
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/admin/places/anything',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).code).toBe('ROLE_FORBIDDEN');
  });
});
