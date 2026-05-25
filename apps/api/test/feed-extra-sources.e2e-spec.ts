/**
 * Integration tests for the 3 extra feed sources added in
 * [IV.18.17.2]:
 *
 *   - sos_triggered  (SosEvent rows where userId == caller)
 *   - expense_added  (Expense rows where paidById == caller)
 *   - vote_cast      (Vote rows where userId == caller; abstains excluded)
 *
 * The merged-stream / cursor / cross-user-isolation behaviors
 * are already covered by `feed.e2e-spec.ts` — this file only
 * verifies that the three new sources surface in the stream
 * with the right payload shape + that vote `value=0`
 * (abstain) rows are correctly excluded.
 *
 * Installed by prompt [IV.18.17.2].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'feed-extra-e2e';
// Suite-local Indian Ocean coord — keeps parallel suites independent.
const COORD = { lat: -8.4095, lng: 115.1889 };

interface FeedItem {
  kind: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

interface FeedBody {
  items: FeedItem[];
  nextBefore: string | null;
}

describe('Feed extra sources (integration, requires Docker Postgres)', () => {
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
      payload: { title: `${TEST_PREFIX}-trip`, center: COORD, radiusKm: 5 },
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { id: string }).id;
  }

  async function getFeed(token: string): Promise<FeedBody> {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/feed/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    return JSON.parse(res.body) as FeedBody;
  }

  it('SOS-triggered surfaces in the feed with resolvedAt payload', async () => {
    const { accessToken } = await registerUser('sos');
    const sosRes = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/sos',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { center: COORD, trigger: 'user_tap' },
    });
    expect(sosRes.statusCode).toBe(201);
    const sosId = (JSON.parse(sosRes.body) as { id: string }).id;

    const body = await getFeed(accessToken);
    const item = body.items.find((i) => i.kind === 'sos_triggered');
    expect(item).toBeDefined();
    const payload = item!.payload as Record<string, unknown>;
    expect(payload['sosEventId']).toBe(sosId);
    expect(payload['trigger']).toBe('user_tap');
    expect(payload['resolvedAt']).toBeNull();
  });

  it('expense_added surfaces in the feed with 2-decimal amount string', async () => {
    const { userId, accessToken } = await registerUser('expense');
    const tripId = await createTrip(accessToken);
    // Seed an Expense directly — the cast-flow has trip-collab gating
    // that's irrelevant here. Direct Prisma is fine for the read aggregator.
    const e = await prisma.expense.create({
      data: {
        tripId,
        paidById: userId,
        amountUsd: '42.5',
        currency: 'USD',
        splitShare: { [userId]: 1 },
      },
    });

    const body = await getFeed(accessToken);
    const item = body.items.find((i) => i.kind === 'expense_added');
    expect(item).toBeDefined();
    const payload = item!.payload as Record<string, unknown>;
    expect(payload['expenseId']).toBe(e.id);
    expect(payload['tripId']).toBe(tripId);
    expect(payload['amountUsd']).toBe('42.50'); // 2-decimal stable wire shape
    expect(payload['currency']).toBe('USD');
  });

  it('vote_cast (+1/-1) surfaces in feed; abstain (value=0) excluded', async () => {
    const { userId, accessToken } = await registerUser('vote');
    const tripId = await createTrip(accessToken);
    const tripIdAbstain = await createTrip(accessToken);

    // Direct seeding — the public cast-vote flow is gated by the
    // collab rule + needs a real itinerary item. Read aggregator
    // doesn't care how the row got there.
    const upVote = await prisma.vote.create({
      data: {
        tripId,
        userId,
        targetType: 'itinerary_item',
        targetId: `${TEST_PREFIX}-target-up`,
        value: 1,
      },
    });
    await prisma.vote.create({
      data: {
        tripId: tripIdAbstain,
        userId,
        targetType: 'itinerary_item',
        targetId: `${TEST_PREFIX}-target-abstain`,
        value: 0,
      },
    });

    const body = await getFeed(accessToken);
    const voteItems = body.items.filter((i) => i.kind === 'vote_cast');
    expect(voteItems).toHaveLength(1);
    const payload = voteItems[0]!.payload as Record<string, unknown>;
    expect(payload['voteId']).toBe(upVote.id);
    expect(payload['value']).toBe(1);
    // Abstain row's id does NOT appear anywhere in the feed.
    const allVoteIds = body.items
      .filter((i) => i.kind === 'vote_cast')
      .map((i) => (i.payload as { voteId: string }).voteId);
    expect(allVoteIds).toEqual([upVote.id]);
  });

  it('cross-user isolation holds for the 3 new sources', async () => {
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');
    // Alice generates one of each new kind.
    await app.inject({
      method: 'POST',
      url: '/api/v1/safety/sos',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { center: COORD, trigger: 'user_tap' },
    });
    const aliceTrip = await createTrip(alice.accessToken);
    await prisma.expense.create({
      data: {
        tripId: aliceTrip,
        paidById: alice.userId,
        amountUsd: '10.0',
        currency: 'USD',
        splitShare: { [alice.userId]: 1 },
      },
    });
    await prisma.vote.create({
      data: {
        tripId: aliceTrip,
        userId: alice.userId,
        targetType: 'itinerary_item',
        targetId: `${TEST_PREFIX}-iso`,
        value: 1,
      },
    });

    const bobBody = await getFeed(bob.accessToken);
    const bobKinds = bobBody.items.map((i) => i.kind);
    expect(bobKinds).not.toContain('sos_triggered');
    expect(bobKinds).not.toContain('expense_added');
    expect(bobKinds).not.toContain('vote_cast');

    // Sanity — Alice's feed has them.
    const aliceBody = await getFeed(alice.accessToken);
    const aliceKinds = aliceBody.items.map((i) => i.kind);
    expect(aliceKinds).toContain('sos_triggered');
    expect(aliceKinds).toContain('expense_added');
    expect(aliceKinds).toContain('vote_cast');
  });
});
