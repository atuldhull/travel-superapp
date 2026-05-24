/**
 * Integration tests for `GET /stays/:id/review-summary`
 * ([IV.18.6.5]).
 *
 * Same composite shape as the place variant
 * (`[IV.18.12.11]`), backed by the same generalized
 * `GetReviewBundleForTargetUseCase`. Stays don't track votes
 * today (vote target types are place / restaurant /
 * itinerary_item per `[IV.18.12.9]`), so the votes block
 * always returns all zeros — verified explicitly here.
 *
 * The `stayId` is treated as opaque — the endpoint doesn't
 * validate it against the Stay catalog. Tests use random
 * suite-prefixed strings; no PostGIS row creation needed.
 *
 * Installed by prompt [IV.18.6.5].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail, uniqueSuffix } from './factories';

const TEST_PREFIX = 'stay-review-summary-e2e';

interface ReviewItem {
  id: string;
  authorId: string;
  rating: number;
  body: string;
}

interface SummaryBody {
  stayId: string;
  reviews: { count: number; average: number; histogram: Record<string, number> };
  votes: { up: number; meh: number; down: number; score: number };
  recentReviews: ReviewItem[];
}

describe('GET /stays/:id/review-summary (integration, requires Docker Postgres)', () => {
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
      console.warn(`stay-review-summary test: DB not reachable (${message}). Skipping.`);
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

  async function postStayReview(
    token: string,
    stayId: string,
    rating: number,
    body: string,
  ): Promise<void> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reviews',
      headers: { authorization: `Bearer ${token}` },
      payload: { targetType: 'stay', targetId: stayId, rating, body },
    });
    expect(res.statusCode).toBe(201);
  }

  async function getSummary(stayId: string): Promise<{ status: number; body: SummaryBody }> {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/stays/${stayId}/review-summary`,
    });
    return { status: res.statusCode, body: JSON.parse(res.body) as SummaryBody };
  }

  it('@Public(): no bearer + empty stay → all-zero shape; votes always zero', async () => {
    if (!dbReachable) return;
    const stayId = `${TEST_PREFIX}-empty-${uniqueSuffix()}`;
    const { status, body } = await getSummary(stayId);
    expect(status).toBe(200);
    expect(body.stayId).toBe(stayId);
    expect(body.reviews).toEqual({
      count: 0,
      average: 0,
      histogram: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    });
    expect(body.votes).toEqual({ up: 0, meh: 0, down: 0, score: 0 });
    expect(body.recentReviews).toEqual([]);
  });

  it('stay with reviews → correct aggregates + recent; votes still zero', async () => {
    if (!dbReachable) return;
    const stayId = `${TEST_PREFIX}-rich-${uniqueSuffix()}`;
    const a = await registerUser('a');
    const b = await registerUser('b');
    const c = await registerUser('c');
    // 3 reviews: 5, 4, 3 → average 4.0, histogram {3:1, 4:1, 5:1}
    await postStayReview(a.accessToken, stayId, 5, 'Lovely stay, would return.');
    await postStayReview(b.accessToken, stayId, 4, 'Solid four-star stay.');
    await postStayReview(c.accessToken, stayId, 3, 'Average. Wifi was patchy.');

    const { status, body } = await getSummary(stayId);
    expect(status).toBe(200);
    expect(body.reviews.count).toBe(3);
    expect(body.reviews.average).toBe(4);
    expect(body.reviews.histogram['5']).toBe(1);
    expect(body.reviews.histogram['4']).toBe(1);
    expect(body.reviews.histogram['3']).toBe(1);

    // Stays don't track votes — the use-case maps stay → no vote
    // target so the votes block is always zero-filled.
    expect(body.votes).toEqual({ up: 0, meh: 0, down: 0, score: 0 });

    expect(body.recentReviews).toHaveLength(3);
  });

  it('cross-target isolation between stay A and stay B', async () => {
    if (!dbReachable) return;
    const stayA = `${TEST_PREFIX}-A-${uniqueSuffix()}`;
    const stayB = `${TEST_PREFIX}-B-${uniqueSuffix()}`;
    const u = await registerUser('iso');
    await postStayReview(u.accessToken, stayA, 5, 'A is great.');
    await postStayReview(u.accessToken, stayA, 4, 'Second review on A.');

    const a = await getSummary(stayA);
    expect(a.body.reviews.count).toBe(2);
    const b = await getSummary(stayB);
    expect(b.body.reviews.count).toBe(0);
  });

  it('stay reviews do NOT leak into the place review summary (different targetType)', async () => {
    if (!dbReachable) return;
    // Same opaque id used for both stayId and placeId — proves
    // the endpoints filter by targetType, not just targetId.
    const sharedId = `${TEST_PREFIX}-shared-${uniqueSuffix()}`;
    const u = await registerUser('cross');
    await postStayReview(u.accessToken, sharedId, 5, 'Stay review only.');

    const stayBody = (await getSummary(sharedId)).body;
    expect(stayBody.reviews.count).toBe(1);

    // Hit the place endpoint with the same id; should be empty.
    const placeRes = await app.inject({
      method: 'GET',
      url: `/api/v1/places/${sharedId}/review-summary`,
    });
    const placeBody = JSON.parse(placeRes.body) as { reviews: { count: number } };
    expect(placeBody.reviews.count).toBe(0);
  });
});
