/**
 * Integration tests for `GET /agents/:id/review-summary`
 * ([IV.18.12.12]).
 *
 * Same composite shape as the place + stay + eatery variants
 * (`[IV.18.12.11]` / `[IV.18.6.5]` / `[IV.18.7.7]`), backed by
 * the same generalized `GetReviewBundleForTargetUseCase`.
 * Agents don't track votes today (vote target types are place /
 * restaurant / itinerary_item per `[IV.18.12.9]`), so the votes
 * block always returns all zeros — verified explicitly here.
 *
 * Closes the review-bundle composite arc: 4-of-4 review-target
 * types covered (place, stay, eatery, agent). The cross-targetType
 * isolation test pins this end-to-end — the same opaque id used
 * across all four routes returns isolated counts.
 *
 * The `agentId` is treated as opaque — the endpoint doesn't
 * validate it against the Agent catalog. Tests use random
 * suite-prefixed strings; no agent row creation needed.
 *
 * Installed by prompt [IV.18.12.12].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';

const TEST_PREFIX = 'agent-review-summary-e2e';

interface ReviewItem {
  id: string;
  authorId: string;
  rating: number;
  body: string;
}

interface SummaryBody {
  agentId: string;
  reviews: { count: number; average: number; histogram: Record<string, number> };
  votes: { up: number; meh: number; down: number; score: number };
  recentReviews: ReviewItem[];
}

describe('GET /agents/:id/review-summary (integration, requires Docker Postgres)', () => {
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
      console.warn(`agent-review-summary test: DB not reachable (${message}). Skipping.`);
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
        email: `${TEST_PREFIX}-${suffix}-${Date.now()}@example.com`,
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-${suffix}`,
      },
    });
    expect(res.statusCode).toBe(201);
    return JSON.parse(res.body) as { userId: string; accessToken: string };
  }

  async function postAgentReview(
    token: string,
    agentId: string,
    rating: number,
    body: string,
  ): Promise<void> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reviews',
      headers: { authorization: `Bearer ${token}` },
      payload: { targetType: 'agent', targetId: agentId, rating, body },
    });
    expect(res.statusCode).toBe(201);
  }

  async function getSummary(agentId: string): Promise<{ status: number; body: SummaryBody }> {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/agents/${agentId}/review-summary`,
    });
    return { status: res.statusCode, body: JSON.parse(res.body) as SummaryBody };
  }

  it('@Public(): no bearer + empty agent → all-zero shape; votes always zero', async () => {
    if (!dbReachable) return;
    const agentId = `${TEST_PREFIX}-empty-${Date.now()}`;
    const { status, body } = await getSummary(agentId);
    expect(status).toBe(200);
    expect(body.agentId).toBe(agentId);
    expect(body.reviews).toEqual({
      count: 0,
      average: 0,
      histogram: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    });
    expect(body.votes).toEqual({ up: 0, meh: 0, down: 0, score: 0 });
    expect(body.recentReviews).toEqual([]);
  });

  it('agent with reviews → correct aggregates + recent; votes still zero', async () => {
    if (!dbReachable) return;
    const agentId = `${TEST_PREFIX}-rich-${Date.now()}`;
    const a = await registerUser('a');
    const b = await registerUser('b');
    const c = await registerUser('c');
    // 3 reviews: 5, 4, 2 → average 3.67, histogram {2:1, 4:1, 5:1}
    await postAgentReview(
      a.accessToken,
      agentId,
      5,
      'Excellent local agent — knew every shortcut.',
    );
    await postAgentReview(b.accessToken, agentId, 4, 'Solid four-star — recommended.');
    await postAgentReview(c.accessToken, agentId, 2, 'Showed up late, communication poor.');

    const { status, body } = await getSummary(agentId);
    expect(status).toBe(200);
    expect(body.reviews.count).toBe(3);
    expect(body.reviews.average).toBeCloseTo(3.67, 2);
    expect(body.reviews.histogram['5']).toBe(1);
    expect(body.reviews.histogram['4']).toBe(1);
    expect(body.reviews.histogram['2']).toBe(1);

    // Agents don't track votes — same as stays + eateries.
    expect(body.votes).toEqual({ up: 0, meh: 0, down: 0, score: 0 });

    expect(body.recentReviews).toHaveLength(3);
  });

  it('cross-target isolation between agent A and agent B', async () => {
    if (!dbReachable) return;
    const agentA = `${TEST_PREFIX}-A-${Date.now()}`;
    const agentB = `${TEST_PREFIX}-B-${Date.now()}`;
    const u = await registerUser('iso');
    await postAgentReview(u.accessToken, agentA, 5, 'A is amazing.');
    await postAgentReview(u.accessToken, agentA, 4, 'Second review on A.');

    const a = await getSummary(agentA);
    expect(a.body.reviews.count).toBe(2);
    const b = await getSummary(agentB);
    expect(b.body.reviews.count).toBe(0);
  });

  it('agent reviews do NOT leak into eatery / stay / place review summaries (4-way targetType isolation)', async () => {
    if (!dbReachable) return;
    const sharedId = `${TEST_PREFIX}-shared-${Date.now()}`;
    const u = await registerUser('cross');
    await postAgentReview(u.accessToken, sharedId, 5, 'Agent review only.');

    const agentBody = (await getSummary(sharedId)).body;
    expect(agentBody.reviews.count).toBe(1);

    // Same opaque id used across the other three review-target endpoints —
    // all return empty. Closes the 4-way isolation contract for v1.
    const eateryRes = await app.inject({
      method: 'GET',
      url: `/api/v1/eateries/${sharedId}/review-summary`,
    });
    expect((JSON.parse(eateryRes.body) as { reviews: { count: number } }).reviews.count).toBe(0);

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
