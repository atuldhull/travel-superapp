/**
 * Integration tests for `GET /feed/trips/:tripId/buddies` (Phase 5,
 * J5) — place-based travel-buddy matchmaking.
 *
 *   1. No bearer → 401.
 *   2. Non-owner source trip → 404 TRIP_NOT_FOUND.
 *   3. A nearby PUBLIC published trip is matched.
 *   4. A far-away published trip is NOT matched.
 *   5. A FOLLOWERS-only nearby trip is NOT matched (PUBLIC only).
 *
 * Installed by prompt [J5].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueSuffix } from './factories';

const TEST_PREFIX = 'buddies-e2e';
// Suite-local base coord (Lisbon-ish). The "far" trip is +20°.
const NEAR = { lat: 38.7223, lng: -9.1393 };
const FAR = { lat: 58.7223, lng: 10.8607 };

interface Buddy {
  tripId: string;
  title: string;
  authorId: string;
}

describe('GET /feed/trips/:tripId/buddies (integration, requires Docker Postgres)', () => {
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
      console.warn(`buddies test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { displayName: { startsWith: TEST_PREFIX } } });
  });

  afterAll(async () => {
    if (dbReachable) await app.close();
    await moduleRef.close();
  });

  async function registerUser(suffix: string): Promise<{ userId: string; accessToken: string }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `${TEST_PREFIX}-${suffix}-${uniqueSuffix()}@example.com`,
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-${suffix}`,
      },
    });
    expect(res.statusCode).toBe(201);
    return JSON.parse(res.body) as { userId: string; accessToken: string };
  }

  async function createTrip(token: string, center: { lat: number; lng: number }): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: `${TEST_PREFIX}-trip`, center, radiusKm: 5 },
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { id: string }).id;
  }

  /** Create a trip at `center`, end it, and publish at `visibility`. */
  async function publishedTrip(
    token: string,
    center: { lat: number; lng: number },
    visibility: 'PUBLIC' | 'FOLLOWERS',
  ): Promise<string> {
    const tripId = await createTrip(token, center);
    await prisma.trip.update({
      where: { id: tripId },
      data: { endsOn: new Date(Date.now() - 7 * 86_400_000) },
    });
    const pub = await app.inject({
      method: 'POST',
      url: `/api/v1/feed/trips/${tripId}/publish`,
      headers: { authorization: `Bearer ${token}` },
      payload: { visibility },
    });
    expect(pub.statusCode).toBe(200);
    return tripId;
  }

  async function buddies(token: string, tripId: string): Promise<Buddy[]> {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/feed/trips/${tripId}/buddies`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    return (JSON.parse(res.body) as { buddies: Buddy[] }).buddies;
  }

  it('no bearer → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/feed/trips/x/buddies' });
    expect(res.statusCode).toBe(401);
  });

  it('non-owner source trip → 404 TRIP_NOT_FOUND', async () => {
    const owner = await registerUser('owner');
    const stranger = await registerUser('stranger');
    const tripId = await createTrip(owner.accessToken, NEAR);
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/feed/trips/${tripId}/buddies`,
      headers: { authorization: `Bearer ${stranger.accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('TRIP_NOT_FOUND');
  });

  it('matches a nearby PUBLIC trip, skips a far one', async () => {
    const me = await registerUser('me');
    const neighbour = await registerUser('neighbour');
    const distant = await registerUser('distant');

    const myTrip = await createTrip(me.accessToken, NEAR);
    const nearTrip = await publishedTrip(neighbour.accessToken, NEAR, 'PUBLIC');
    const farTrip = await publishedTrip(distant.accessToken, FAR, 'PUBLIC');

    const list = await buddies(me.accessToken, myTrip);
    const ids = list.map((b) => b.tripId);
    expect(ids).toContain(nearTrip);
    expect(ids).not.toContain(farTrip);
  });

  it('does not match a FOLLOWERS-only nearby trip', async () => {
    const me = await registerUser('me2');
    const neighbour = await registerUser('neighbour2');

    const myTrip = await createTrip(me.accessToken, NEAR);
    const followersTrip = await publishedTrip(neighbour.accessToken, NEAR, 'FOLLOWERS');

    const list = await buddies(me.accessToken, myTrip);
    expect(list.map((b) => b.tripId)).not.toContain(followersTrip);
  });
});
