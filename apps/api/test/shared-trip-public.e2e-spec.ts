/**
 * Integration tests for V.UX.10 public shared-trip surfaces:
 *   - POST /trips/shared/:code/clone (auth required)
 *   - POST /trips/shared/:code/heart (@Public, IP-throttled)
 *   - GET  /trips/shared/:code/hearts (@Public)
 *
 * Installed by prompt [V.UX.10].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'shared-public-e2e';
const REMOTE = { lat: -12.4321, lng: 132.5678 };

interface Trip {
  readonly id: string;
  readonly title: string;
}

describe('V.UX.10 shared-trip public surfaces (integration)', () => {
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
      console.warn(`shared-public test: infra not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (dbReachable) {
      await prisma.user.deleteMany({
        where: { displayName: { startsWith: TEST_PREFIX } },
      });
    }
  });

  afterAll(async () => {
    if (dbReachable) await app.close();
    await moduleRef.close();
  });

  async function registerUser(suffix: string): Promise<{ accessToken: string; userId: string }> {
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
    return JSON.parse(res.body) as { accessToken: string; userId: string };
  }

  async function ownerCreatesShareableTrip(): Promise<{
    ownerToken: string;
    code: string;
    tripId: string;
  }> {
    const owner = await registerUser('owner');
    const trip = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        title: 'Public link test',
        center: REMOTE,
        radiusKm: 5,
        startsOn: '2026-09-01T00:00:00.000Z',
        endsOn: '2026-09-02T00:00:00.000Z',
      },
    });
    expect(trip.statusCode).toBe(201);
    const tripId = (JSON.parse(trip.body) as Trip).id;

    const gen = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/itinerary`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(gen.statusCode).toBe(200);

    const share = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/share`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {},
    });
    expect(share.statusCode).toBe(201);
    const code = (JSON.parse(share.body) as { shareCode: string }).shareCode;
    return { ownerToken: owner.accessToken, code, tripId };
  }

  it('clone — auth required; result owned by caller; deep-copies days', async () => {
    if (!dbReachable) return;
    const { code } = await ownerCreatesShareableTrip();
    const recipient = await registerUser('recipient');

    // Anonymous → 401.
    const anon = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/shared/${code}/clone`,
    });
    expect(anon.statusCode).toBe(401);

    // Auth'd recipient — 201 with new trip id.
    const cloned = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/shared/${code}/clone`,
      headers: { authorization: `Bearer ${recipient.accessToken}` },
    });
    expect(cloned.statusCode).toBe(201);
    const body = JSON.parse(cloned.body) as Trip & { userId: string };
    expect(body.title).toContain('(saved)');
    expect(body.userId).toBe(recipient.userId);

    // Cloned trip has its own itinerary days (deep copy).
    const itin = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${body.id}/itinerary`,
      headers: { authorization: `Bearer ${recipient.accessToken}` },
    });
    expect(itin.statusCode).toBe(200);
    const days = (JSON.parse(itin.body) as { days: Array<{ id: string }> }).days;
    expect(days.length).toBeGreaterThanOrEqual(1);
  });

  it('clone — bad code → 404 SHARE_NOT_FOUND', async () => {
    if (!dbReachable) return;
    const recipient = await registerUser('bad');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips/shared/not-a-real-code/clone',
      headers: { authorization: `Bearer ${recipient.accessToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('heart — anonymous bumps counter; GET reflects', async () => {
    if (!dbReachable) return;
    const { code, tripId } = await ownerCreatesShareableTrip();

    const initialGet = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/shared/${code}/hearts`,
    });
    expect(initialGet.statusCode).toBe(200);
    const initial = JSON.parse(initialGet.body) as { hearts: number; tripId: string };
    expect(initial.tripId).toBe(tripId);
    const baseline = initial.hearts;

    const heart = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/shared/${code}/heart`,
    });
    expect(heart.statusCode).toBe(200);
    const after = JSON.parse(heart.body) as { hearts: number };
    expect(after.hearts).toBe(baseline + 1);

    // GET sees the bump.
    const post = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/shared/${code}/hearts`,
    });
    expect((JSON.parse(post.body) as { hearts: number }).hearts).toBe(baseline + 1);
  });

  it('heart — bad code → 404', async () => {
    if (!dbReachable) return;
    const heart = await app.inject({
      method: 'POST',
      url: '/api/v1/trips/shared/totally-fake/heart',
    });
    expect(heart.statusCode).toBe(404);
  });
});
