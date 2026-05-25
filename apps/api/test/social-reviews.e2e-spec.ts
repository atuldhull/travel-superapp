/**
 * Integration tests for the Social Review surface ([IV.18.12.5]).
 *
 *   POST   /reviews                              create (standalone or trip-attached)
 *   GET    /reviews?targetType=&targetId=        list by target
 *   GET    /reviews/mine                         list caller's own
 *   DELETE /reviews/:id                          author-only delete
 *
 * Reviews are trip-optional: a standalone review just needs auth;
 * a trip-attached review uses the collaborative-voting gate.
 *
 * Installed by prompt [IV.18.12.5].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'social-reviews-e2e';
const CENTER = { lat: -2.3456, lng: 106.7891 };

interface ReviewResp {
  readonly id: string;
  readonly authorId: string;
  readonly tripId: string | null;
  readonly targetType: string;
  readonly targetId: string;
  readonly rating: number;
  readonly body: string;
  readonly language: string;
}

describe('Social reviews (integration, requires Postgres)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await app.register(fastifyCookie);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = moduleRef.get(PrismaService);
    await prisma.$queryRaw`SELECT 1`;
  });

  afterEach(async () => {
    // User cascade-deletes Trip + Review rows.
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
  });

  afterAll(async () => {
    await app.close();
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
      payload: {
        title: `${TEST_PREFIX}-trip`,
        center: CENTER,
        radiusKm: 5,
      },
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { id: string }).id;
  }

  it('POST /reviews without a bearer → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reviews',
      payload: {
        targetType: 'place',
        targetId: 'place-x',
        rating: 5,
        body: 'Great!',
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('standalone review (tripId absent) works for any authed user', async () => {
    const alice = await registerUser('standalone');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reviews',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: {
        targetType: 'place',
        targetId: `${TEST_PREFIX}-place-1`,
        rating: 4,
        body: `${TEST_PREFIX}: solid coffee, wifi decent, crowded on weekends.`,
      },
    });
    expect(res.statusCode).toBe(201);
    const review = JSON.parse(res.body) as ReviewResp;
    expect(review.authorId).toBe(alice.userId);
    expect(review.tripId).toBeNull();
    expect(review.rating).toBe(4);
    expect(review.language).toBe('en');
  });

  it('trip-attached review: author must own the trip OR have collab access', async () => {
    const alice = await registerUser('t-owner');
    const stranger = await registerUser('t-stranger');
    const tripId = await createTrip(alice.accessToken);

    // Alice (owner) can attach a review to her trip.
    const ok = await app.inject({
      method: 'POST',
      url: '/api/v1/reviews',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: {
        tripId,
        targetType: 'eatery',
        targetId: `${TEST_PREFIX}-eatery-1`,
        rating: 5,
        body: `${TEST_PREFIX}: dinner was amazing.`,
      },
    });
    expect(ok.statusCode).toBe(201);

    // Stranger cannot (no share on the trip).
    const forbidden = await app.inject({
      method: 'POST',
      url: '/api/v1/reviews',
      headers: { authorization: `Bearer ${stranger.accessToken}` },
      payload: {
        tripId,
        targetType: 'eatery',
        targetId: `${TEST_PREFIX}-eatery-1`,
        rating: 1,
        body: `${TEST_PREFIX}: sabotage attempt`,
      },
    });
    expect(forbidden.statusCode).toBe(404);
    expect(JSON.parse(forbidden.body).code).toBe('TRIP_NOT_FOUND');
  });

  it('listing by target returns every review on that target, most-recent-first', async () => {
    const alice = await registerUser('l-a');
    const bob = await registerUser('l-b');
    const targetId = `${TEST_PREFIX}-place-list`;

    await app.inject({
      method: 'POST',
      url: '/api/v1/reviews',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: {
        targetType: 'place',
        targetId,
        rating: 5,
        body: `${TEST_PREFIX}: Alice loved it.`,
      },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/reviews',
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: {
        targetType: 'place',
        targetId,
        rating: 3,
        body: `${TEST_PREFIX}: Bob thought it was OK.`,
      },
    });

    // Anyone authed can read — use Alice's token.
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/reviews?targetType=place&targetId=${targetId}`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { reviews: ReviewResp[] };
    expect(body.reviews).toHaveLength(2);
    // Most-recent-first: Bob's came second, so first in the list.
    expect(body.reviews[0]!.authorId).toBe(bob.userId);
    expect(body.reviews[1]!.authorId).toBe(alice.userId);
  });

  it('missing required query params on GET → 400 VALIDATION_FAILED', async () => {
    const { accessToken } = await registerUser('miss-q');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reviews',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });

  it('GET /reviews/mine returns only the caller’s own reviews', async () => {
    const alice = await registerUser('mine-a');
    const bob = await registerUser('mine-b');
    await app.inject({
      method: 'POST',
      url: '/api/v1/reviews',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: {
        targetType: 'place',
        targetId: `${TEST_PREFIX}-a`,
        rating: 5,
        body: `${TEST_PREFIX}: Alice`,
      },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/reviews',
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: {
        targetType: 'place',
        targetId: `${TEST_PREFIX}-b`,
        rating: 3,
        body: `${TEST_PREFIX}: Bob`,
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reviews/mine',
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { reviews: ReviewResp[] };
    expect(body.reviews).toHaveLength(1);
    expect(body.reviews[0]!.authorId).toBe(alice.userId);
  });

  it('author can delete their own review; non-author → 404', async () => {
    const alice = await registerUser('del-a');
    const bob = await registerUser('del-b');
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/reviews',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: {
        targetType: 'stay',
        targetId: `${TEST_PREFIX}-stay-1`,
        rating: 2,
        body: `${TEST_PREFIX}: noisy room.`,
      },
    });
    const reviewId = (JSON.parse(create.body) as { id: string }).id;

    // Bob tries → 404.
    const attempt = await app.inject({
      method: 'DELETE',
      url: `/api/v1/reviews/${reviewId}`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(attempt.statusCode).toBe(404);
    expect(JSON.parse(attempt.body).code).toBe('REVIEW_NOT_FOUND');

    // Alice succeeds.
    const ok = await app.inject({
      method: 'DELETE',
      url: `/api/v1/reviews/${reviewId}`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(ok.statusCode).toBe(204);
  });

  it('rating out of [1,5] → 422 INVALID_RATING', async () => {
    const { accessToken } = await registerUser('bad-rating');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reviews',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        targetType: 'place',
        targetId: `${TEST_PREFIX}-x`,
        rating: 6,
        body: `${TEST_PREFIX}: body`,
      },
    });
    expect(res.statusCode).toBe(422);
    // Zod rejects first (integer().max(5)) — VALIDATION_FAILED is the expected shape.
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });

  it('empty body → 422 VALIDATION_FAILED (Zod min(1))', async () => {
    const { accessToken } = await registerUser('empty-body');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reviews',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        targetType: 'place',
        targetId: `${TEST_PREFIX}-x`,
        rating: 5,
        body: '',
      },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });

  it('a user can post multiple reviews on the same target (no unique constraint)', async () => {
    const alice = await registerUser('multi');
    const targetId = `${TEST_PREFIX}-multi-target`;
    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/reviews',
        headers: { authorization: `Bearer ${alice.accessToken}` },
        payload: {
          targetType: 'place',
          targetId,
          rating: 4,
          body: `${TEST_PREFIX}: review ${i + 1}`,
        },
      });
      expect(res.statusCode).toBe(201);
    }
    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/reviews?targetType=place&targetId=${targetId}`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    const body = JSON.parse(list.body) as { reviews: ReviewResp[] };
    expect(body.reviews).toHaveLength(3);
  });
});
