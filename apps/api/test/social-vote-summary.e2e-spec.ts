/**
 * Integration tests for `GET /votes/summary` ([IV.18.12.9]).
 *
 * Cross-trip vote tally `{ targetType, targetId, up, meh, down,
 * score }`. `@Public()` — no auth needed (vote counts are crowd
 * signal, not PII). Aggregates across every trip the target
 * appears in.
 *
 * Seeding: tests insert Vote rows directly via Prisma (the
 * cast-vote flow is gated by the collab-trip rule + needs a real
 * itinerary item; the summary endpoint reads from the same table
 * regardless of how the rows got there).
 *
 * Installed by prompt [IV.18.12.9].
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

const TEST_PREFIX = 'vote-summary-e2e';
// Suite-local coord — keeps parallel geo tests independent.
const CENTER = { lat: 28.6139, lng: 77.209 };

interface SummaryBody {
  targetType: string;
  targetId: string;
  up: number;
  meh: number;
  down: number;
  score: number;
}

describe('GET /votes/summary (integration, requires Docker Postgres)', () => {
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
    // User cascade-deletes Trip + Vote rows.
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

  /**
   * Create a Trip via the public API. PostGIS columns can't be
   * inserted via typed Prisma writes (CLAUDE rule 11) so we use
   * the trip-create endpoint instead of `prisma.trip.create`.
   */
  async function createTrip(token: string, suffix: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: `${TEST_PREFIX}-${suffix}`,
        center: CENTER,
        radiusKm: 5,
      },
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { id: string }).id;
  }

  async function seedVote(
    tripId: string,
    userId: string,
    targetId: string,
    value: -1 | 0 | 1,
  ): Promise<void> {
    await prisma.vote.create({
      data: {
        tripId,
        userId,
        targetType: 'itinerary_item',
        targetId,
        value,
      },
    });
  }

  async function getSummary(targetId: string): Promise<{ status: number; body: SummaryBody }> {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/votes/summary?targetType=itinerary_item&targetId=${encodeURIComponent(targetId)}`,
    });
    return { status: res.statusCode, body: JSON.parse(res.body) as SummaryBody };
  }

  it('empty target → 200 with all zeros (NOT 404)', async () => {
    const targetId = `${TEST_PREFIX}-empty-${uniqueSuffix()}`;
    const { status, body } = await getSummary(targetId);
    expect(status).toBe(200);
    expect(body).toEqual({
      targetType: 'itinerary_item',
      targetId,
      up: 0,
      meh: 0,
      down: 0,
      score: 0,
    });
    // Silence "geo unused" — geo is wired but we don't insert places here.
    expect(geo).toBeDefined();
  });

  it('mix of +1/0/-1 votes → correct up/meh/down/score', async () => {
    const targetId = `${TEST_PREFIX}-rich-${uniqueSuffix()}`;
    const a = await registerUser('a');
    const b = await registerUser('b');
    const c = await registerUser('c');
    const d = await registerUser('d');
    const tripA = await createTrip(a.accessToken, 'tA');
    const tripB = await createTrip(b.accessToken, 'tB');
    const tripC = await createTrip(c.accessToken, 'tC');
    const tripD = await createTrip(d.accessToken, 'tD');
    // 3 up, 1 meh, 1 down → score = 3 - 1 = 2.
    await seedVote(tripA, a.userId, targetId, 1);
    await seedVote(tripB, b.userId, targetId, 1);
    await seedVote(tripC, c.userId, targetId, 1);
    await seedVote(tripD, d.userId, targetId, 0);
    // Same user can vote on the same target across two different trips
    // — the unique key is (tripId, userId, targetType, targetId).
    const tripA2 = await createTrip(a.accessToken, 'tA2');
    await seedVote(tripA2, a.userId, targetId, -1);

    const { status, body } = await getSummary(targetId);
    expect(status).toBe(200);
    expect(body.up).toBe(3);
    expect(body.meh).toBe(1);
    expect(body.down).toBe(1);
    expect(body.score).toBe(2);
  });

  it('cross-target isolation: A’s votes don’t affect B’s summary', async () => {
    const targetA = `${TEST_PREFIX}-A-${uniqueSuffix()}`;
    const targetB = `${TEST_PREFIX}-B-${uniqueSuffix()}`;
    const u = await registerUser('iso');
    const trip = await createTrip(u.accessToken, 'iso-trip');
    await seedVote(trip, u.userId, targetA, 1);

    const a = await getSummary(targetA);
    expect(a.body.up).toBe(1);
    expect(a.body.score).toBe(1);
    const bSum = await getSummary(targetB);
    expect(bSum.body.up).toBe(0);
    expect(bSum.body.down).toBe(0);
    expect(bSum.body.score).toBe(0);
  });

  it('missing query params → 400 VALIDATION_FAILED', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/votes/summary' });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });

  it('unknown targetType → 400 VALIDATION_FAILED', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/votes/summary?targetType=bogus&targetId=x',
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });

  it('@Public(): no bearer required', async () => {
    const targetId = `${TEST_PREFIX}-public-${uniqueSuffix()}`;
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/votes/summary?targetType=itinerary_item&targetId=${targetId}`,
    });
    expect(res.statusCode).toBe(200);
  });
});
