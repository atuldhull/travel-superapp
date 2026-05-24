/**
 * Integration tests for `GET /feed/people` (Phase 5, J3) — the
 * "discover travellers" suggestion list.
 *
 *   1. No bearer → 401.
 *   2. A viewer is suggested an author who published a PUBLIC trip.
 *   3. The author is NOT suggested to themselves.
 *   4. An already-followed author is excluded.
 *   5. A FOLLOWERS-only author is not suggested (PUBLIC only).
 *
 * Installed by prompt [J3].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueSuffix } from './factories';

const TEST_PREFIX = 'suggested-e2e';
// Suite-local Adriatic coord.
const COORD = { lat: 42.6507, lng: 18.0944 };

interface Traveller {
  userId: string;
  displayName: string;
  publishedCount: number;
}

describe('GET /feed/people (integration, requires Docker Postgres)', () => {
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
      console.warn(`suggested test: DB not reachable (${message}). Skipping.`);
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
        email: `${TEST_PREFIX}-${suffix}-${uniqueSuffix()}@example.com`,
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-${suffix}`,
      },
    });
    expect(res.statusCode).toBe(201);
    return JSON.parse(res.body) as { userId: string; accessToken: string };
  }

  /** Create a trip, stamp it ended, and publish at `visibility`. */
  async function publishTrip(token: string, visibility: 'PUBLIC' | 'FOLLOWERS'): Promise<string> {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: `${TEST_PREFIX}-trip`, center: COORD, radiusKm: 5 },
    });
    expect(create.statusCode).toBe(201);
    const tripId = (JSON.parse(create.body) as { id: string }).id;
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

  async function follow(token: string, targetId: string): Promise<void> {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/users/${targetId}/follow`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  }

  async function people(token: string): Promise<Traveller[]> {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/feed/people',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    return (JSON.parse(res.body) as { travellers: Traveller[] }).travellers;
  }

  it('no bearer → 401', async () => {
    if (!dbReachable) return;
    const res = await app.inject({ method: 'GET', url: '/api/v1/feed/people' });
    expect(res.statusCode).toBe(401);
  });

  it('suggests an author who published a PUBLIC trip', async () => {
    if (!dbReachable) return;
    const author = await registerUser('author');
    const viewer = await registerUser('viewer');
    await publishTrip(author.accessToken, 'PUBLIC');

    const list = await people(viewer.accessToken);
    const hit = list.find((t) => t.userId === author.userId);
    expect(hit).toBeDefined();
    expect(hit!.publishedCount).toBeGreaterThanOrEqual(1);
    expect(hit!.displayName).toContain(TEST_PREFIX);
  });

  it('does not suggest the author to themselves', async () => {
    if (!dbReachable) return;
    const author = await registerUser('solo');
    await publishTrip(author.accessToken, 'PUBLIC');

    const list = await people(author.accessToken);
    expect(list.find((t) => t.userId === author.userId)).toBeUndefined();
  });

  it('excludes an already-followed author', async () => {
    if (!dbReachable) return;
    const author = await registerUser('known');
    const viewer = await registerUser('fan');
    await publishTrip(author.accessToken, 'PUBLIC');
    await follow(viewer.accessToken, author.userId);

    const list = await people(viewer.accessToken);
    expect(list.find((t) => t.userId === author.userId)).toBeUndefined();
  });

  it('does not suggest a FOLLOWERS-only author (PUBLIC trips only)', async () => {
    if (!dbReachable) return;
    const author = await registerUser('private-ish');
    const viewer = await registerUser('viewer2');
    await publishTrip(author.accessToken, 'FOLLOWERS');

    const list = await people(viewer.accessToken);
    expect(list.find((t) => t.userId === author.userId)).toBeUndefined();
  });
});
