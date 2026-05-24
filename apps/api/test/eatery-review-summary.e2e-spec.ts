/**
 * Integration tests for `GET /eateries/:id/review-summary`
 * ([IV.18.7.7]).
 *
 * Same composite shape as the place + stay variants
 * (`[IV.18.12.11]` / `[IV.18.6.5]`), backed by the same
 * generalized `GetReviewBundleForTargetUseCase`. Eateries
 * don't track votes today (vote target types are place /
 * restaurant / itinerary_item per `[IV.18.12.9]`), so the
 * votes block always returns all zeros — verified explicitly
 * here.
 *
 * The `eateryId` is treated as opaque — the endpoint doesn't
 * validate it against the Eatery catalog. Tests use random
 * suite-prefixed strings; no PostGIS row creation needed.
 *
 * Installed by prompt [IV.18.7.7].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail, uniqueSuffix } from './factories';

const TEST_PREFIX = 'eatery-review-summary-e2e';

interface ReviewItem {
  id: string;
  authorId: string;
  rating: number;
  body: string;
}

interface SummaryBody {
  eateryId: string;
  reviews: { count: number; average: number; histogram: Record<string, number> };
  votes: { up: number; meh: number; down: number; score: number };
  recentReviews: ReviewItem[];
}

describe('GET /eateries/:id/review-summary (integration, requires Docker Postgres)', () => {
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
      console.warn(`eatery-review-summary test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
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

  async function postEateryReview(
    token: string,
    eateryId: string,
    rating: number,
    body: string,
  ): Promise<void> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reviews',
      headers: { authorization: `Bearer ${token}` },
      payload: { targetType: 'eatery', targetId: eateryId, rating, body },
    });
    expect(res.statusCode).toBe(201);
  }

  async function getSummary(eateryId: string): Promise<{ status: number; body: SummaryBody }> {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/eateries/${eateryId}/review-summary`,
    });
    return { status: res.statusCode, body: JSON.parse(res.body) as SummaryBody };
  }

  it('@Public(): no bearer + empty eatery → all-zero shape; votes always zero', async () => {
    const eateryId = `${TEST_PREFIX}-empty-${uniqueSuffix()}`;
    const { status, body } = await getSummary(eateryId);
    expect(status).toBe(200);
    expect(body.eateryId).toBe(eateryId);
    expect(body.reviews).toEqual({
      count: 0,
      average: 0,
      histogram: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    });
    expect(body.votes).toEqual({ up: 0, meh: 0, down: 0, score: 0 });
    expect(body.recentReviews).toEqual([]);
  });

  it('eatery with reviews → correct aggregates + recent; votes still zero', async () => {
    const eateryId = `${TEST_PREFIX}-rich-${uniqueSuffix()}`;
    const a = await registerUser('a');
    const b = await registerUser('b');
    const c = await registerUser('c');
    // 3 reviews: 5, 4, 2 → average 3.67, histogram {2:1, 4:1, 5:1}
    await postEateryReview(a.accessToken, eateryId, 5, 'Great food, friendly staff.');
    await postEateryReview(b.accessToken, eateryId, 4, 'Solid four-star meal.');
    await postEateryReview(c.accessToken, eateryId, 2, 'Cold food and slow service.');

    const { status, body } = await getSummary(eateryId);
    expect(status).toBe(200);
    expect(body.reviews.count).toBe(3);
    expect(body.reviews.average).toBeCloseTo(3.67, 2);
    expect(body.reviews.histogram['5']).toBe(1);
    expect(body.reviews.histogram['4']).toBe(1);
    expect(body.reviews.histogram['2']).toBe(1);

    // Eateries don't track votes — same as stays.
    expect(body.votes).toEqual({ up: 0, meh: 0, down: 0, score: 0 });

    expect(body.recentReviews).toHaveLength(3);
  });

  it('cross-target isolation between eatery A and eatery B', async () => {
    const eateryA = `${TEST_PREFIX}-A-${uniqueSuffix()}`;
    const eateryB = `${TEST_PREFIX}-B-${uniqueSuffix()}`;
    const u = await registerUser('iso');
    await postEateryReview(u.accessToken, eateryA, 5, 'A is amazing.');
    await postEateryReview(u.accessToken, eateryA, 4, 'Second review on A.');

    const a = await getSummary(eateryA);
    expect(a.body.reviews.count).toBe(2);
    const b = await getSummary(eateryB);
    expect(b.body.reviews.count).toBe(0);
  });

  it('eatery reviews do NOT leak into stay or place review summaries (different targetType)', async () => {
    const sharedId = `${TEST_PREFIX}-shared-${uniqueSuffix()}`;
    const u = await registerUser('cross');
    await postEateryReview(u.accessToken, sharedId, 5, 'Eatery review only.');

    const eateryBody = (await getSummary(sharedId)).body;
    expect(eateryBody.reviews.count).toBe(1);

    // Same opaque id used for stay + place endpoints — both return empty.
    const stayRes = await app.inject({
      method: 'GET',
      url: `/api/v1/stays/${sharedId}/review-summary`,
    });
    expect((JSON.parse(stayRes.body) as { reviews: { count: number } }).reviews.count).toBe(0);

    const placeRes = await app.inject({
      method: 'GET',
      url: `/api/v1/places/${sharedId}/review-summary`,
    });
    expect((JSON.parse(placeRes.body) as { reviews: { count: number } }).reviews.count).toBe(0);
  });
});
