/**
 * Integration tests for `GET /feed/trips/:tripId/publish` (Phase 5,
 * J1) — the owner-facing publication-status read that powers the
 * web publish panel.
 *
 *   1. No bearer → 401.
 *   2. Non-owner → 404 TRIP_NOT_FOUND (existence-probe defence).
 *   3. Never-published trip → 200 { published: false, PRIVATE }.
 *   4. Published trip → 200 { published: true, visibility, publishedAt }.
 *   5. Unpublished-after-publish → 200 { published: false }.
 *
 * Publishing is privacy-fenced to ENDED trips, so the test stamps
 * `endsOn` into the past directly via Prisma before publishing.
 *
 * Installed by prompt [J1].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'pubstatus-e2e';
// Suite-local Aegean coord — keeps parallel suites independent.
const COORD = { lat: 37.4467, lng: 25.3289 };

interface StatusBody {
  published: boolean;
  visibility: string;
  publishedAt: string | null;
  exposedLat: number | null;
  exposedLng: number | null;
}

describe('GET /feed/trips/:tripId/publish (integration, requires Docker Postgres)', () => {
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
      console.warn(`pubstatus test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (!dbReachable) return;
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
        email: uniqueEmail(`${TEST_PREFIX}-${suffix}`),
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-${suffix}`,
      },
    });
    expect(res.statusCode).toBe(201);
    return JSON.parse(res.body) as { userId: string; accessToken: string };
  }

  async function createTrip(token: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: `${TEST_PREFIX}-trip`, center: COORD, radiusKm: 5 },
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { id: string }).id;
  }

  /** Stamp `endsOn` into the past so the trip is publishable. */
  async function markEnded(tripId: string): Promise<void> {
    await prisma.trip.update({
      where: { id: tripId },
      data: { endsOn: new Date(Date.now() - 7 * 86_400_000) },
    });
  }

  async function getStatus(token: string, tripId: string): Promise<StatusBody> {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/feed/trips/${tripId}/publish`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    return JSON.parse(res.body) as StatusBody;
  }

  it('no bearer → 401', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/feed/trips/some-trip/publish',
    });
    expect(res.statusCode).toBe(401);
  });

  it('non-owner → 404 TRIP_NOT_FOUND', async () => {
    if (!dbReachable) return;
    const owner = await registerUser('owner-a');
    const stranger = await registerUser('stranger');
    const tripId = await createTrip(owner.accessToken);
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/feed/trips/${tripId}/publish`,
      headers: { authorization: `Bearer ${stranger.accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('TRIP_NOT_FOUND');
  });

  it('never-published trip → { published: false, PRIVATE }', async () => {
    if (!dbReachable) return;
    const owner = await registerUser('owner-b');
    const tripId = await createTrip(owner.accessToken);
    const body = await getStatus(owner.accessToken, tripId);
    expect(body.published).toBe(false);
    expect(body.visibility).toBe('PRIVATE');
    expect(body.publishedAt).toBeNull();
  });

  it('published trip → { published: true, visibility, publishedAt }', async () => {
    if (!dbReachable) return;
    const owner = await registerUser('owner-c');
    const tripId = await createTrip(owner.accessToken);
    await markEnded(tripId);

    const pub = await app.inject({
      method: 'POST',
      url: `/api/v1/feed/trips/${tripId}/publish`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { visibility: 'PUBLIC' },
    });
    expect(pub.statusCode).toBe(200);

    const body = await getStatus(owner.accessToken, tripId);
    expect(body.published).toBe(true);
    expect(body.visibility).toBe('PUBLIC');
    expect(typeof body.publishedAt).toBe('string');
  });

  it('unpublished after publish → { published: false }', async () => {
    if (!dbReachable) return;
    const owner = await registerUser('owner-d');
    const tripId = await createTrip(owner.accessToken);
    await markEnded(tripId);

    await app.inject({
      method: 'POST',
      url: `/api/v1/feed/trips/${tripId}/publish`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { visibility: 'FOLLOWERS' },
    });
    const unpub = await app.inject({
      method: 'DELETE',
      url: `/api/v1/feed/trips/${tripId}/publish`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(unpub.statusCode).toBe(200);

    const body = await getStatus(owner.accessToken, tripId);
    expect(body.published).toBe(false);
    expect(body.publishedAt).toBeNull();
  });
});
