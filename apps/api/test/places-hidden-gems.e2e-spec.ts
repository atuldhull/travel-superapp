/**
 * Integration tests for `POST /api/v1/places/hidden-gems`
 * ([V.UX.19]).
 *
 * Hyper-local discovery surface for the domestic / day-trip
 * persona. A "gem" has 5..50 reviews (inclusive) — enough
 * social validation to trust, not so popular it's a tourist trap.
 * Sorted by descending average rating; ties → higher review count
 * wins.
 *
 *   1. POST without bearer → 401 UNAUTHENTICATED.
 *   2. radiusKm > 300 → 422 INVALID_RADIUS.
 *   3. Empty area → 200 with empty list.
 *   4. Mixed seed:
 *        - place A: 0 reviews          → excluded
 *        - place B: 4 reviews avg=5    → excluded (below 5 cutoff)
 *        - place C: 10 reviews avg=4.6 → included (top — highest avg)
 *        - place D: 25 reviews avg=4.2 → included (middle)
 *        - place E: 51 reviews avg=4.9 → excluded (above 50 cutoff)
 *      Expect [C, D] in that order; gems[*].reviewCount each in
 *      [5, 50]; reviewAverage rounded to 2 decimals.
 *   5. limit clamps result count.
 *
 * The remote coord (5.6789, -163.4321) is unique to this suite so
 * parallel tests don't race on PostGIS rows (see
 * feedback_unique_test_coords.md).
 *
 * Installed by prompt [V.UX.19].
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

const TEST_PREFIX = 'places-hidden-gems-e2e';
const ANCHOR = { lat: 5.6789, lng: -163.4321 };

interface GemBody {
  id: string;
  name: string;
  reviewCount: number;
  reviewAverage: number;
  distanceMeters: number;
}
interface GemsResponse {
  gems: GemBody[];
}

describe('POST /places/hidden-gems (integration, requires Docker Postgres)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let geo: GeoQueries;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await app.register(fastifyCookie);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = moduleRef.get(PrismaService);
    geo = moduleRef.get(GeoQueries);
    await prisma.$queryRaw`SELECT 1`;
  });

  afterEach(async () => {
    await prisma.review.deleteMany({
      where: { body: { startsWith: TEST_PREFIX } },
    });
    await prisma.place.deleteMany({
      where: { sourceKey: { startsWith: TEST_PREFIX } },
    });
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
  });

  afterAll(async () => {
    await app.close();
    await moduleRef.close();
  });

  async function registerAndGetToken(suffix: string): Promise<string> {
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
    return (JSON.parse(res.body) as { accessToken: string }).accessToken;
  }

  async function ensureAuthor(): Promise<string> {
    // Single re-usable author — Review has no (authorId, targetId)
    // uniqueness so 51 rows from one user is fine for the volume
    // assertion. Sidesteps the register-endpoint throttle.
    const email = `${TEST_PREFIX}-author@example.com`;
    const existing = await prisma.user.findFirst({
      where: { displayName: `${TEST_PREFIX}-author` },
      select: { id: true },
    });
    if (existing) return existing.id;
    const created = await prisma.user.create({
      data: {
        emailHash: `${TEST_PREFIX}-author-hash-${uniqueSuffix()}`,
        emailEncrypted: Buffer.from(email, 'utf8'),
        passwordHash: 'x',
        displayName: `${TEST_PREFIX}-author`,
      },
    });
    return created.id;
  }

  async function seedPlace(name: string): Promise<string> {
    const p = await geo.insertPlace({
      sourceKey: `${TEST_PREFIX}-${name}-${uniqueSuffix()}`,
      name: `${TEST_PREFIX}-${name}`,
      category: 'cafe',
      lat: ANCHOR.lat + (Math.random() - 0.5) * 0.001,
      lng: ANCHOR.lng + (Math.random() - 0.5) * 0.001,
    });
    return p.id;
  }

  async function seedReviews(placeId: string, ratings: readonly number[]): Promise<void> {
    if (ratings.length === 0) return;
    const authorId = await ensureAuthor();
    await prisma.review.createMany({
      data: ratings.map((rating, idx) => ({
        authorId,
        targetType: 'place',
        targetId: placeId,
        rating,
        body: `${TEST_PREFIX}-review-${placeId}-${idx}`,
      })),
    });
  }

  it('POST without bearer → 401 UNAUTHENTICATED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/places/hidden-gems',
      payload: { center: ANCHOR, radiusKm: 50 },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('radiusKm > 300 → 422 INVALID_RADIUS', async () => {
    const token = await registerAndGetToken('over');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/places/hidden-gems',
      headers: { authorization: `Bearer ${token}` },
      payload: { center: ANCHOR, radiusKm: 301 },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('INVALID_RADIUS');
  });

  it('empty area returns 200 with empty list', async () => {
    const token = await registerAndGetToken('empty');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/places/hidden-gems',
      headers: { authorization: `Bearer ${token}` },
      payload: { center: ANCHOR, radiusKm: 50 },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as GemsResponse;
    expect(body.gems).toEqual([]);
  });

  it('filters places to the gem zone (5..50 reviews) and sorts by avg rating desc', async () => {
    const placeA = await seedPlace('A-zero');
    const placeB = await seedPlace('B-below');
    const placeC = await seedPlace('C-top');
    const placeD = await seedPlace('D-mid');
    const placeE = await seedPlace('E-popular');

    // A: 0 reviews → excluded.
    // B: 4 reviews avg 5 → excluded (below cutoff).
    await seedReviews(placeB, [5, 5, 5, 5]);
    // C: 10 reviews avg 4.6.
    await seedReviews(placeC, [5, 5, 5, 5, 5, 5, 4, 4, 4, 4]);
    // D: 25 reviews avg 4.0 (5*5 + 4*15 + 3*5 = 100, /25).
    await seedReviews(
      placeD,
      [5, 5, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3],
    );
    // E: 51 reviews avg ~4.9 → excluded (above cutoff).
    await seedReviews(
      placeE,
      Array.from({ length: 51 }, (_, i) => (i < 5 ? 4 : 5)),
    );

    const token = await registerAndGetToken('mixed');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/places/hidden-gems',
      headers: { authorization: `Bearer ${token}` },
      payload: { center: ANCHOR, radiusKm: 50 },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as GemsResponse;
    const ids = body.gems.map((g) => g.id);
    expect(ids).toEqual([placeC, placeD]);
    expect(ids).not.toContain(placeA);
    expect(ids).not.toContain(placeB);
    expect(ids).not.toContain(placeE);
    for (const g of body.gems) {
      expect(g.reviewCount).toBeGreaterThanOrEqual(5);
      expect(g.reviewCount).toBeLessThanOrEqual(50);
    }
    // 2-decimal rounding — 4.6 echoes as 4.6, not 4.6000…
    expect(body.gems[0]!.reviewAverage).toBeCloseTo(4.6, 2);
    expect(body.gems[1]!.reviewAverage).toBeCloseTo(4.0, 2);
    // gems are sorted by descending avg rating.
    expect(body.gems[0]!.reviewAverage).toBeGreaterThan(body.gems[1]!.reviewAverage);
  });

  it('limit clamps the result count', async () => {
    const placeA = await seedPlace('A-lim');
    const placeB = await seedPlace('B-lim');
    await seedReviews(placeA, [5, 5, 5, 5, 5, 5, 5]);
    await seedReviews(placeB, [4, 4, 4, 4, 4, 4]);

    const token = await registerAndGetToken('limit');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/places/hidden-gems',
      headers: { authorization: `Bearer ${token}` },
      payload: { center: ANCHOR, radiusKm: 50, limit: 1 },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as GemsResponse;
    expect(body.gems).toHaveLength(1);
    expect(body.gems[0]!.id).toBe(placeA);
  });
});
