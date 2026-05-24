/**
 * Integration tests for `GET /places/:id/review-summary`
 * ([IV.18.12.11]).
 *
 * Composite endpoint that bundles `/reviews/summary` +
 * `/votes/summary` + recent reviews into one round-trip for
 * the place detail page.
 *
 *   1. No bearer needed — `@Public()`.
 *   2. Empty place → 200 with all-zero shape (NOT 404).
 *   3. Place with N reviews + M votes → correct aggregates +
 *      recent reviews list (capped at 5).
 *   4. recentReviews capped at 5 even when N > 5; reviews.count
 *      reflects all.
 *   5. Cross-target isolation: place A's data doesn't leak into
 *      place B's summary.
 *
 * Installed by prompt [IV.18.12.11].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { GeoQueries } from '../src/common/db/geo-queries';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail, uniqueSuffix } from './factories';

const TEST_PREFIX = 'place-review-summary-e2e';
const COORD = { lat: 60.1699, lng: 24.9384 };

interface ReviewItem {
  id: string;
  authorId: string;
  rating: number;
  body: string;
}

interface SummaryBody {
  placeId: string;
  reviews: { count: number; average: number; histogram: Record<string, number> };
  votes: { up: number; meh: number; down: number; score: number };
  recentReviews: ReviewItem[];
}

describe('GET /places/:id/review-summary (integration, requires Docker Postgres)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let geo: GeoQueries;
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
      geo = moduleRef.get(GeoQueries);
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`place-review-summary test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (!dbReachable) return;
    await prisma.place.deleteMany({
      where: { sourceKey: { startsWith: TEST_PREFIX } },
    });
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

  async function createPlace(suffix: string): Promise<string> {
    const place = await geo.insertPlace({
      sourceKey: `${TEST_PREFIX}-${suffix}-${uniqueSuffix()}`,
      name: `${TEST_PREFIX}-${suffix}`,
      category: 'museum',
      lat: COORD.lat,
      lng: COORD.lng,
    });
    return place.id;
  }

  async function postReview(
    token: string,
    placeId: string,
    rating: number,
    body: string,
  ): Promise<void> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reviews',
      headers: { authorization: `Bearer ${token}` },
      payload: { targetType: 'place', targetId: placeId, rating, body },
    });
    expect(res.statusCode).toBe(201);
  }

  async function seedVote(
    tripId: string,
    userId: string,
    placeId: string,
    value: -1 | 0 | 1,
  ): Promise<void> {
    await prisma.vote.create({
      data: {
        tripId,
        userId,
        targetType: 'place',
        targetId: placeId,
        value,
      },
    });
  }

  async function getSummary(placeId: string): Promise<{ status: number; body: SummaryBody }> {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/places/${placeId}/review-summary`,
    });
    return { status: res.statusCode, body: JSON.parse(res.body) as SummaryBody };
  }

  it('@Public(): no bearer required + empty place → all-zero shape', async () => {
    if (!dbReachable) return;
    const placeId = await createPlace('empty');
    const { status, body } = await getSummary(placeId);
    expect(status).toBe(200);
    expect(body.placeId).toBe(placeId);
    expect(body.reviews.count).toBe(0);
    expect(body.reviews.average).toBe(0);
    expect(body.reviews.histogram).toEqual({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 });
    expect(body.votes).toEqual({ up: 0, meh: 0, down: 0, score: 0 });
    expect(body.recentReviews).toEqual([]);
  });

  it('place with reviews + votes returns correct aggregates + recent', async () => {
    if (!dbReachable) return;
    const placeId = await createPlace('rich');
    const a = await registerUser('a');
    const b = await registerUser('b');
    const c = await registerUser('c');
    const tripA = await createTrip(a.accessToken);
    const tripB = await createTrip(b.accessToken);

    // 3 reviews: 5, 4, 2 → average 3.67, histogram {5:1, 4:1, 2:1}
    await postReview(a.accessToken, placeId, 5, 'Five-star place. Amazing.');
    await postReview(b.accessToken, placeId, 4, 'Four stars, solid place.');
    await postReview(c.accessToken, placeId, 2, 'Disappointing visit.');

    // Votes: 2 up, 1 down → score 1
    await seedVote(tripA, a.userId, placeId, 1);
    await seedVote(tripB, b.userId, placeId, 1);
    const tripC = await createTrip(c.accessToken);
    await seedVote(tripC, c.userId, placeId, -1);

    const { status, body } = await getSummary(placeId);
    expect(status).toBe(200);
    expect(body.reviews.count).toBe(3);
    expect(body.reviews.average).toBeCloseTo(3.67, 2);
    expect(body.reviews.histogram['5']).toBe(1);
    expect(body.reviews.histogram['4']).toBe(1);
    expect(body.reviews.histogram['2']).toBe(1);

    expect(body.votes.up).toBe(2);
    expect(body.votes.down).toBe(1);
    expect(body.votes.score).toBe(1);

    expect(body.recentReviews).toHaveLength(3);
    // Each review has the expected shape.
    for (const r of body.recentReviews) {
      expect(r.id).toBeTruthy();
      expect(typeof r.rating).toBe('number');
      expect(r.body.length).toBeGreaterThan(0);
    }
  });

  it('recentReviews capped at 5; reviews.count reflects all', async () => {
    if (!dbReachable) return;
    const placeId = await createPlace('capped');
    // 7 different authors so the unique-key constraint
    // (tripId, userId, targetType, targetId) doesn't bite — each
    // author posts a single review on the place.
    for (let i = 0; i < 7; i++) {
      const u = await registerUser(`cap-${i}`);
      await postReview(u.accessToken, placeId, 4, `Review number ${i}, decent place.`);
    }

    const { body } = await getSummary(placeId);
    expect(body.reviews.count).toBe(7);
    expect(body.recentReviews).toHaveLength(5);
  });

  it('cross-target isolation: place A doesn’t leak into place B', async () => {
    if (!dbReachable) return;
    const placeA = await createPlace('A');
    const placeB = await createPlace('B');
    const u = await registerUser('iso');
    await postReview(u.accessToken, placeA, 5, 'Review on A.');
    await postReview(u.accessToken, placeA, 4, 'Second review on A.');

    const a = await getSummary(placeA);
    expect(a.body.reviews.count).toBe(2);
    const b = await getSummary(placeB);
    expect(b.body.reviews.count).toBe(0);
    expect(b.body.recentReviews).toEqual([]);
  });

  it('returns the placeId echoed in the response (clients can validate)', async () => {
    if (!dbReachable) return;
    const placeId = await createPlace('echo');
    const { body } = await getSummary(placeId);
    expect(body.placeId).toBe(placeId);
  });
});
