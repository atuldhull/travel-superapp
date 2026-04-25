/**
 * Integration tests for `GET /feed/me` ([IV.18.17.1]).
 *
 * Personal activity feed merging trips + reviews + memory book
 * publishes + scam reports into one chronological stream with
 * cursor pagination.
 *
 *   1. No bearer → 401.
 *   2. Empty user → 200 `{ items: [], nextBefore: null }`.
 *   3. Rich user (trip + review + memory book + scam report)
 *      → all 4 kinds present, sorted desc by occurredAt.
 *   4. Cursor pagination: `?limit=2` returns top 2 + a
 *      `nextBefore` cursor; passing it back returns strictly
 *      older items.
 *   5. Cross-user isolation: Bob's feed never includes
 *      Alice's activity.
 *
 * Installed by prompt [IV.18.17.1].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';

const TEST_PREFIX = 'feed-e2e';
// Suite-local Mediterranean coord — keeps parallel suites independent.
const COORD = { lat: 43.7384, lng: 7.4246 };

interface FeedItem {
  kind: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

interface FeedBody {
  items: FeedItem[];
  nextBefore: string | null;
}

describe('GET /feed/me (integration, requires Docker Postgres)', () => {
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
      console.warn(`feed test: DB not reachable (${message}). Skipping.`);
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

  async function postReview(token: string, targetId: string, rating = 4): Promise<void> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reviews',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        targetType: 'place',
        targetId,
        rating,
        body: 'feed-e2e seed review body, decent',
      },
    });
    expect(res.statusCode).toBe(201);
  }

  async function createAndPublishMemoryBook(token: string): Promise<string> {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/memory-books',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: `${TEST_PREFIX}-album` },
    });
    expect(create.statusCode).toBe(201);
    const id = (JSON.parse(create.body) as { id: string }).id;
    const pub = await app.inject({
      method: 'POST',
      url: `/api/v1/memory-books/${id}/publish`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(pub.statusCode).toBe(200);
    return id;
  }

  async function fileScamReport(token: string): Promise<void> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/scam-reports',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        center: { lat: COORD.lat + 0.001, lng: COORD.lng + 0.001 },
        category: 'pickpocket',
        severity: 'medium',
        description: 'feed-e2e scam report body — describes the activity.',
      },
    });
    expect(res.statusCode).toBe(201);
  }

  async function getFeed(token: string, query = ''): Promise<FeedBody> {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/feed/me${query}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    return JSON.parse(res.body) as FeedBody;
  }

  it('GET /feed/me without bearer → 401', async () => {
    if (!dbReachable) return;
    const res = await app.inject({ method: 'GET', url: '/api/v1/feed/me' });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('empty user → 200 { items: [], nextBefore: null }', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('empty');
    const body = await getFeed(accessToken);
    expect(body.items).toEqual([]);
    expect(body.nextBefore).toBeNull();
  });

  it('rich user → all 4 kinds present, sorted desc by occurredAt', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('rich');
    // Sequence with small gaps so timestamps strictly order.
    await createTrip(accessToken);
    await new Promise((r) => setTimeout(r, 30));
    await postReview(accessToken, `${TEST_PREFIX}-target-${Date.now()}`);
    await new Promise((r) => setTimeout(r, 30));
    await createAndPublishMemoryBook(accessToken);
    await new Promise((r) => setTimeout(r, 30));
    await fileScamReport(accessToken);

    const body = await getFeed(accessToken);
    const kinds = body.items.map((i) => i.kind);
    expect(kinds).toContain('trip');
    expect(kinds).toContain('review');
    expect(kinds).toContain('memory_book_published');
    expect(kinds).toContain('scam_report');

    // Sorted desc.
    for (let i = 1; i < body.items.length; i++) {
      const prev = new Date(body.items[i - 1]!.occurredAt).getTime();
      const cur = new Date(body.items[i]!.occurredAt).getTime();
      expect(prev).toBeGreaterThanOrEqual(cur);
    }
    // Newest event was the scam report — first item.
    expect(body.items[0]!.kind).toBe('scam_report');
  });

  it('cursor pagination: limit=2 + before=cursor → strictly older items', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('paginate');
    // 5 reviews with small gaps so each gets a distinct createdAt.
    for (let i = 0; i < 5; i++) {
      await postReview(accessToken, `${TEST_PREFIX}-p-${Date.now()}-${i}`, 3);
      await new Promise((r) => setTimeout(r, 25));
    }

    const first = await getFeed(accessToken, '?limit=2');
    expect(first.items).toHaveLength(2);
    expect(first.nextBefore).not.toBeNull();
    const cursor = first.nextBefore!;

    const second = await getFeed(accessToken, `?limit=2&before=${encodeURIComponent(cursor)}`);
    expect(second.items.length).toBeGreaterThanOrEqual(1);
    // Every item in page 2 is strictly older than the cursor.
    const cursorMs = new Date(cursor).getTime();
    for (const item of second.items) {
      expect(new Date(item.occurredAt).getTime()).toBeLessThan(cursorMs);
    }
    // No overlap: the page-2 items are not in page-1.
    const firstReviewIds = first.items
      .filter((i) => i.kind === 'review')
      .map((i) => (i.payload as { reviewId: string }).reviewId);
    for (const item of second.items) {
      if (item.kind === 'review') {
        const id = (item.payload as { reviewId: string }).reviewId;
        expect(firstReviewIds).not.toContain(id);
      }
    }
  });

  it('cross-user isolation: Bob’s feed never sees Alice’s activity', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');
    // Alice generates activity; Bob stays quiet.
    await createTrip(alice.accessToken);
    await postReview(alice.accessToken, `${TEST_PREFIX}-x-${Date.now()}`);
    await fileScamReport(alice.accessToken);

    const bobFeed = await getFeed(bob.accessToken);
    expect(bobFeed.items).toEqual([]);
    expect(bobFeed.nextBefore).toBeNull();

    // Sanity — Alice's feed has the activity.
    const aliceFeed = await getFeed(alice.accessToken);
    expect(aliceFeed.items.length).toBeGreaterThanOrEqual(3);
  });
});
