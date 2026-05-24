/**
 * Integration tests for PATCH + DELETE /trips/:id ([IV.18.2.3.1]).
 *
 * Covers:
 *   1. PATCH updates title / radius / dates, bumps `version`.
 *   2. Empty body → 422 VALIDATION_FAILED.
 *   3. Radius > 500 → 422 INVALID_RADIUS.
 *   4. New startsOn > stored endsOn → 422 INVALID_DATE_RANGE
 *      (effective-value check uses stored + patch fields).
 *   5. Date change wipes an existing itinerary.
 *   6. Patch on another user's trip → 404 TRIP_NOT_FOUND.
 *   7. Unauthenticated → 401 UNAUTHENTICATED.
 *   8. DELETE own trip → 204 + row + cascaded itinerary rows gone.
 *   9. DELETE again → 404 TRIP_NOT_FOUND (idempotence signal).
 *  10. DELETE another user's trip → 404.
 *
 * Installed by prompt [IV.18.2.3.1].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'trip-crud';
const VICTORIA = { lat: 51.4952, lng: -0.1441 };

describe('Trip PATCH + DELETE (integration, requires Docker Postgres)', () => {
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
      console.warn(`trip-crud test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
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
      headers: { 'user-agent': 'crud-ua' },
    });
    expect(res.statusCode).toBe(201);
    return JSON.parse(res.body) as { userId: string; accessToken: string };
  }

  async function createTrip(
    accessToken: string,
    extra: { title?: string; radiusKm?: number; startsOn?: string; endsOn?: string } = {},
  ): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: extra.title ?? 'test trip',
        center: VICTORIA,
        radiusKm: extra.radiusKm ?? 5,
        ...(extra.startsOn ? { startsOn: extra.startsOn } : {}),
        ...(extra.endsOn ? { endsOn: extra.endsOn } : {}),
      },
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { id: string }).id;
  }

  it('PATCH updates title + radius + dates and bumps version', async () => {
    const { accessToken } = await registerUser('patch-ok');
    const tripId = await createTrip(accessToken, { title: 'old' });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/trips/${tripId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: 'new',
        radiusKm: 20,
        startsOn: '2026-08-01',
        endsOn: '2026-08-05',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { title: string; radiusKm: number; version: number };
    expect(body.title).toBe('new');
    expect(body.radiusKm).toBe(20);
    expect(body.version).toBe(2); // bumped from 1 → 2.
  });

  it('empty patch body → 422 VALIDATION_FAILED', async () => {
    const { accessToken } = await registerUser('empty');
    const tripId = await createTrip(accessToken);
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/trips/${tripId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });

  it('PATCH radius > 500 → 422 INVALID_RADIUS', async () => {
    const { accessToken } = await registerUser('bad-radius');
    const tripId = await createTrip(accessToken);
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/trips/${tripId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { radiusKm: 700 },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('INVALID_RADIUS');
  });

  it('PATCH with startsOn > stored endsOn → 422 INVALID_DATE_RANGE', async () => {
    const { accessToken } = await registerUser('bad-range');
    const tripId = await createTrip(accessToken, {
      startsOn: '2026-08-01',
      endsOn: '2026-08-05',
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/trips/${tripId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { startsOn: '2026-08-10' }, // after stored endsOn.
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('INVALID_DATE_RANGE');
  });

  it('date change wipes existing itinerary rows', async () => {
    const { accessToken } = await registerUser('wipe-itin');
    const tripId = await createTrip(accessToken, {
      startsOn: '2026-08-01',
      endsOn: '2026-08-03',
    });
    // Generate a 3-day itinerary.
    await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/itinerary`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const before = await prisma.itineraryDay.count({ where: { tripId } });
    expect(before).toBe(3);

    // Change endsOn — must wipe the itinerary.
    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/trips/${tripId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { endsOn: '2026-08-07' },
    });
    expect(patch.statusCode).toBe(200);
    const after = await prisma.itineraryDay.count({ where: { tripId } });
    expect(after).toBe(0);
  });

  it("PATCH another user's trip → 404 TRIP_NOT_FOUND", async () => {
    const alice = await registerUser('a-idor');
    const bob = await registerUser('b-idor');
    const tripId = await createTrip(alice.accessToken, { title: 'alice' });
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/trips/${tripId}`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: { title: 'hijacked' },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('TRIP_NOT_FOUND');
  });

  it('unauthenticated PATCH → 401 UNAUTHENTICATED', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/trips/any-id',
      payload: { title: 'x' },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('DELETE own trip → 204, row + cascaded itinerary gone', async () => {
    const { accessToken } = await registerUser('del-ok');
    const tripId = await createTrip(accessToken, {
      startsOn: '2026-08-01',
      endsOn: '2026-08-02',
    });
    // Seed itinerary first so we can assert cascade.
    await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/itinerary`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(await prisma.itineraryDay.count({ where: { tripId } })).toBe(2);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/trips/${tripId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(204);

    expect(await prisma.trip.findUnique({ where: { id: tripId } })).toBeNull();
    expect(await prisma.itineraryDay.count({ where: { tripId } })).toBe(0);
  });

  it('DELETE twice → second returns 404', async () => {
    const { accessToken } = await registerUser('del-twice');
    const tripId = await createTrip(accessToken);

    const first = await app.inject({
      method: 'DELETE',
      url: `/api/v1/trips/${tripId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(first.statusCode).toBe(204);

    const second = await app.inject({
      method: 'DELETE',
      url: `/api/v1/trips/${tripId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(second.statusCode).toBe(404);
    expect(JSON.parse(second.body).code).toBe('TRIP_NOT_FOUND');
  });

  it("DELETE another user's trip → 404", async () => {
    const alice = await registerUser('a-del');
    const bob = await registerUser('b-del');
    const tripId = await createTrip(alice.accessToken);
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/trips/${tripId}`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('TRIP_NOT_FOUND');
    // Alice's trip still exists.
    expect(await prisma.trip.findUnique({ where: { id: tripId } })).not.toBeNull();
  });
});
