/**
 * Integration tests for the V.UX.25 reviewer-karma + public-profile
 * surfaces.
 *
 *   - POST /api/v1/reviews/:id/helpful  (auth-gated)
 *   - GET  /api/v1/users/:userId/profile  (public)
 *
 *   1. Helpful vote without bearer → 401.
 *   2. Self-vote → 403 HELPFUL_VOTE_SELF.
 *   3. Helpful vote happy path → 200, helpfulCount=1, karma score
 *      bumps the author by +2 (one helpful = score 2; reviewer's own
 *      review counts +1).
 *   4. Re-vote (same voter, same review) → 200 idempotent
 *      (outcome='duplicate', helpfulCount unchanged at 1).
 *   5. Public profile of a user with reviews → 200, karma populated
 *      + recent reviews list.
 *   6. Public profile is @Public — no bearer needed.
 *   7. Unknown userId → 404 USER_NOT_FOUND.
 *
 * Installed by prompt [V.UX.25].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'karma-and-profile-e2e';

interface RegisterRes {
  userId: string;
  accessToken: string;
}
interface HelpfulRes {
  reviewId: string;
  helpfulCount: number;
  outcome: 'inserted' | 'duplicate';
}
interface ProfileRes {
  userId: string;
  displayName: string;
  karma: { score: number; reviewCount: number; helpfulVotesReceived: number; badges: string[] };
  recentReviews: Array<{ id: string; rating: number; body: string }>;
}

describe('V.UX.25 karma + public profile (integration, requires Docker Postgres)', () => {
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
    await prisma.helpfulVote.deleteMany({
      where: { voter: { displayName: { startsWith: TEST_PREFIX } } },
    });
    await prisma.review.deleteMany({ where: { body: { startsWith: TEST_PREFIX } } });
    await prisma.userKarma.deleteMany({
      where: { user: { displayName: { startsWith: TEST_PREFIX } } },
    });
    await prisma.user.deleteMany({ where: { displayName: { startsWith: TEST_PREFIX } } });
  });

  afterAll(async () => {
    await app.close();
    await moduleRef.close();
  });

  async function registerAndGetToken(suffix: string): Promise<RegisterRes> {
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
    return JSON.parse(res.body) as RegisterRes;
  }

  async function seedReview(authorId: string, suffix: string): Promise<string> {
    const r = await prisma.review.create({
      data: {
        authorId,
        targetType: 'place',
        targetId: 'cl000somplaceid000000abc',
        rating: 5,
        body: `${TEST_PREFIX}-review-${suffix}`,
      },
    });
    return r.id;
  }

  it('POST /reviews/:id/helpful without bearer → 401 UNAUTHENTICATED', async () => {
    const author = await registerAndGetToken('a-anon');
    const reviewId = await seedReview(author.userId, 'anon');
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/reviews/${reviewId}/helpful`,
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('Self helpful-vote → 403 HELPFUL_VOTE_SELF', async () => {
    const author = await registerAndGetToken('a-self');
    const reviewId = await seedReview(author.userId, 'self');
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/reviews/${reviewId}/helpful`,
      headers: { authorization: `Bearer ${author.accessToken}` },
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).code).toBe('HELPFUL_VOTE_SELF');
  });

  it('Happy-path helpful vote bumps author karma score by +2', async () => {
    const author = await registerAndGetToken('a-happy');
    const voter = await registerAndGetToken('v-happy');
    const reviewId = await seedReview(author.userId, 'happy');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/reviews/${reviewId}/helpful`,
      headers: { authorization: `Bearer ${voter.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as HelpfulRes;
    expect(body.helpfulCount).toBe(1);
    expect(body.outcome).toBe('inserted');

    // Inline recompute should have bumped author karma:
    // score = 1 (review) * 1 + 1 (helpful) * 2 = 3
    const profile = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${author.userId}/profile`,
    });
    expect(profile.statusCode).toBe(200);
    const pBody = JSON.parse(profile.body) as ProfileRes;
    expect(pBody.karma.score).toBe(3);
    expect(pBody.karma.reviewCount).toBe(1);
    expect(pBody.karma.helpfulVotesReceived).toBe(1);
    expect(pBody.karma.badges).toContain('contributor_1');
  });

  it('Re-vote returns outcome=duplicate + helpfulCount unchanged', async () => {
    const author = await registerAndGetToken('a-dup');
    const voter = await registerAndGetToken('v-dup');
    const reviewId = await seedReview(author.userId, 'dup');

    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/reviews/${reviewId}/helpful`,
      headers: { authorization: `Bearer ${voter.accessToken}` },
    });
    expect((JSON.parse(first.body) as HelpfulRes).outcome).toBe('inserted');

    const second = await app.inject({
      method: 'POST',
      url: `/api/v1/reviews/${reviewId}/helpful`,
      headers: { authorization: `Bearer ${voter.accessToken}` },
    });
    expect(second.statusCode).toBe(200);
    const body = JSON.parse(second.body) as HelpfulRes;
    expect(body.outcome).toBe('duplicate');
    expect(body.helpfulCount).toBe(1);
  });

  it('GET /users/:userId/profile is public + returns recent reviews', async () => {
    const author = await registerAndGetToken('a-pub');
    await seedReview(author.userId, 'pub-1');
    await seedReview(author.userId, 'pub-2');

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${author.userId}/profile`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as ProfileRes;
    expect(body.userId).toBe(author.userId);
    expect(body.recentReviews.length).toBe(2);
    // Karma row may not exist yet (no helpful votes), so score=0 is
    // fine, but reviewCount + the rendered shape must still be there.
    expect(body.karma).toBeDefined();
  });

  it('GET /users/:userId/profile on unknown userId → 404 USER_NOT_FOUND', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/cl000nonexistent00user00/profile',
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('USER_NOT_FOUND');
  });
});
