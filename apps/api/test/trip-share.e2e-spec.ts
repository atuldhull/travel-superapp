/**
 * Integration tests for Trip sharing ([IV.18.2.13]).
 *
 * Covers the full loop: owner mints a share code, recipient resolves
 * it via the public route. IDOR + expiry + misuse cases all hit the
 * same HTTP surface.
 *
 * Installed by prompt [IV.18.2.13].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';

const TEST_PREFIX = 'share-e2e';
// Suite-local coord — avoids cross-suite Place contamination (see
// memory/feedback_unique_test_coords.md). No Place rows involved,
// but the Trip center still occupies PostGIS space; keep it unique.
const REMOTE = { lat: 65.4321, lng: -168.7654 };

describe('Trip sharing (integration, requires Docker Postgres)', () => {
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
      console.warn(`trip-share test: DB not reachable (${message}). Skipping.`);
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
    displayName: string;
  }> {
    const displayName = `${TEST_PREFIX}-${suffix}`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `${TEST_PREFIX}-${suffix}-${Date.now()}@example.com`,
        password: 'correct-horse-battery-staple',
        displayName,
      },
    });
    expect(res.statusCode).toBe(201);
    const { userId, accessToken } = JSON.parse(res.body) as {
      userId: string;
      accessToken: string;
    };
    return { userId, accessToken, displayName };
  }

  async function createTrip(accessToken: string, title: string): Promise<{ id: string }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title,
        center: REMOTE,
        radiusKm: 7,
        startsOn: '2026-09-01',
        endsOn: '2026-09-05',
      },
    });
    expect(res.statusCode).toBe(201);
    return { id: (JSON.parse(res.body) as { id: string }).id };
  }

  it('POST /trips/:id/share mints a code; public GET /trips/shared/:code returns metadata + owner name', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('alice');
    const trip = await createTrip(alice.accessToken, 'Alpine getaway');

    const mint = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${trip.id}/share`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: {},
    });
    expect(mint.statusCode).toBe(201);
    const mintBody = JSON.parse(mint.body) as {
      id: string;
      tripId: string;
      shareCode: string;
      expiresAt: string | null;
    };
    expect(mintBody.tripId).toBe(trip.id);
    expect(mintBody.expiresAt).toBeNull();
    // base64url, 16 chars (12 random bytes). Entropy + URL safety check.
    expect(mintBody.shareCode).toMatch(/^[A-Za-z0-9_-]{16}$/);

    // Resolving the share code — UNAUTHENTICATED. The @Public() decorator
    // on GET /trips/shared/:code lets the request through the JwtAuthGuard.
    const resolved = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/shared/${mintBody.shareCode}`,
    });
    expect(resolved.statusCode).toBe(200);
    const body = JSON.parse(resolved.body) as {
      id: string;
      title: string;
      radiusKm: number;
      ownerDisplayName: string;
      startsOn: string;
      endsOn: string;
    };
    expect(body.id).toBe(trip.id);
    expect(body.title).toBe('Alpine getaway');
    expect(body.radiusKm).toBe(7);
    expect(body.ownerDisplayName).toBe(alice.displayName);
    // Sensitive fields NOT exposed on the public surface.
    expect(body).not.toHaveProperty('userId');
    expect(body).not.toHaveProperty('ownerId');
    // Itinerary slot is always present — empty until the owner
    // generates one ([IV.18.2.14] fold-in).
    expect(Array.isArray((body as unknown as { days: unknown[] }).days)).toBe(true);
    expect((body as unknown as { days: unknown[] }).days).toHaveLength(0);
  });

  it('GET /trips/shared/:code includes itinerary days once the owner has generated one', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('with-itin');
    const trip = await createTrip(alice.accessToken, 'With itinerary');

    const gen = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${trip.id}/itinerary`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(gen.statusCode).toBe(200);
    const genBody = JSON.parse(gen.body) as { days: unknown[] };
    expect(genBody.days.length).toBeGreaterThan(0);

    const mint = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${trip.id}/share`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: {},
    });
    const { shareCode } = JSON.parse(mint.body) as { shareCode: string };

    const resolved = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/shared/${shareCode}`,
    });
    expect(resolved.statusCode).toBe(200);
    const body = JSON.parse(resolved.body) as {
      days: Array<{ id: string; dayIndex: number; date: string; items: unknown[] }>;
    };
    expect(body.days.length).toBe(genBody.days.length);
    // Day shape matches the owner's own GET /trips/:id/itinerary.
    expect(body.days[0]).toHaveProperty('id');
    expect(body.days[0]).toHaveProperty('dayIndex');
    expect(body.days[0]).toHaveProperty('date');
    expect(Array.isArray(body.days[0]!.items)).toBe(true);
  });

  it('DELETE /trips/:id/share/:code by owner → 204; resolve after → 404 SHARE_NOT_FOUND', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('revoke-ok');
    const trip = await createTrip(alice.accessToken, 'Revoke test');

    const mint = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${trip.id}/share`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: {},
    });
    const { shareCode } = JSON.parse(mint.body) as { shareCode: string };

    const revoke = await app.inject({
      method: 'DELETE',
      url: `/api/v1/trips/${trip.id}/share/${shareCode}`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(revoke.statusCode).toBe(204);

    const resolved = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/shared/${shareCode}`,
    });
    expect(resolved.statusCode).toBe(404);
    expect(JSON.parse(resolved.body).code).toBe('SHARE_NOT_FOUND');
  });

  it('DELETE /trips/:id/share/:code by non-owner → 404 SHARE_NOT_FOUND', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('a-rev-idor');
    const bob = await registerUser('b-rev-idor');
    const trip = await createTrip(alice.accessToken, 'Alice revoke IDOR');

    const mint = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${trip.id}/share`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: {},
    });
    const { shareCode } = JSON.parse(mint.body) as { shareCode: string };

    const revoke = await app.inject({
      method: 'DELETE',
      url: `/api/v1/trips/${trip.id}/share/${shareCode}`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(revoke.statusCode).toBe(404);
    expect(JSON.parse(revoke.body).code).toBe('SHARE_NOT_FOUND');

    // Code still works for the recipient — the non-owner attempt
    // must not have flipped `publicRead`.
    const resolved = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/shared/${shareCode}`,
    });
    expect(resolved.statusCode).toBe(200);
  });

  it('DELETE /trips/:id/share/:code for an unknown code → 404 SHARE_NOT_FOUND', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('rev-404');
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/trips/any/share/does-not-exist-xx',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('SHARE_NOT_FOUND');
  });

  it('DELETE /trips/:id/share/:code twice → second call returns 404 (idempotent from client POV)', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('rev-twice');
    const trip = await createTrip(alice.accessToken, 'Revoke twice');
    const mint = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${trip.id}/share`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: {},
    });
    const { shareCode } = JSON.parse(mint.body) as { shareCode: string };

    const first = await app.inject({
      method: 'DELETE',
      url: `/api/v1/trips/${trip.id}/share/${shareCode}`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(first.statusCode).toBe(204);

    const second = await app.inject({
      method: 'DELETE',
      url: `/api/v1/trips/${trip.id}/share/${shareCode}`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    // 404 on the second call is correct: `publicRead` is already
    // false, so the WHERE clause on the `updateMany` finds zero
    // matching rows. The row still exists in the DB but is dead
    // to both the owner (re-revoke) and the recipient.
    expect(second.statusCode).toBe(404);
    expect(JSON.parse(second.body).code).toBe('SHARE_NOT_FOUND');
  });

  it('POST /trips/:id/share by a non-owner → 404 TRIP_NOT_FOUND (IDOR + existence probe defence)', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('a-idor');
    const bob = await registerUser('b-idor');
    const trip = await createTrip(alice.accessToken, 'Alice private');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${trip.id}/share`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('TRIP_NOT_FOUND');
  });

  it('POST /trips/:id/share without a bearer → 401 UNAUTHENTICATED', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips/nope/share',
      payload: {},
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('POST /trips/:id/share with a past expiresAt → 422 INVALID_EXPIRY', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('past-exp');
    const trip = await createTrip(accessToken, 'Past expiry test');
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${trip.id}/share`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { expiresAt: '2020-01-01T00:00:00Z' },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('INVALID_EXPIRY');
  });

  it('GET /trips/shared/:code with an unknown code → 404 SHARE_NOT_FOUND', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/trips/shared/does-not-exist-xx',
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('SHARE_NOT_FOUND');
  });

  it('GET /trips/shared/:code with an expired share → 404 SHARE_EXPIRED', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('expired');
    const trip = await createTrip(alice.accessToken, 'Expired trip');

    // Future-dated create (DTO rejects past dates), then back-date the
    // expiresAt column directly so we can observe the expiry branch
    // without timing games.
    const mint = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${trip.id}/share`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { expiresAt: new Date(Date.now() + 60_000).toISOString() },
    });
    expect(mint.statusCode).toBe(201);
    const { shareCode } = JSON.parse(mint.body) as { shareCode: string };

    await prisma.tripShare.update({
      where: { shareCode },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/shared/${shareCode}`,
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('SHARE_EXPIRED');
  });

  it('deleting the trip cascades the TripShare row (recipient sees 404)', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('cascade');
    const trip = await createTrip(alice.accessToken, 'Cascade test');

    const mint = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${trip.id}/share`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: {},
    });
    const { shareCode } = JSON.parse(mint.body) as { shareCode: string };

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/trips/${trip.id}`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(del.statusCode).toBe(204);

    const resolved = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/shared/${shareCode}`,
    });
    // Schema has ON DELETE CASCADE on TripShare.tripId — the share
    // row is gone, so the resolver sees SHARE_NOT_FOUND.
    expect(resolved.statusCode).toBe(404);
    expect(JSON.parse(resolved.body).code).toBe('SHARE_NOT_FOUND');
  });
});
