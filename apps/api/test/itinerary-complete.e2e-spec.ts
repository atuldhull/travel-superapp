/**
 * Integration tests for the "Living Trip" item-completion routes:
 *
 *   POST /api/v1/trips/items/:itemId/complete
 *   POST /api/v1/trips/items/:itemId/uncomplete
 *
 * Phase 3 (G1). The routes are owner-gated through the item's day's
 * trip relation; a non-owner OR a missing itemId collapse to 404
 * ITEM_NOT_FOUND (existence-probe defence).
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'g1-checkmark-e2e';
const REMOTE = { lat: 11.1111, lng: -11.1111 };

describe('Itinerary item completion (G1, integration)', () => {
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
      console.warn(`g1-checkmark test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (dbReachable) {
      await prisma.user.deleteMany({ where: { displayName: { startsWith: TEST_PREFIX } } });
    }
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

  async function createTripWithItem(
    accessToken: string,
  ): Promise<{ tripId: string; itemId: string }> {
    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: 'g1 trip',
        center: REMOTE,
        radiusKm: 5,
        startsOn: new Date('2026-08-01T00:00:00Z').toISOString(),
        endsOn: new Date('2026-08-03T00:00:00Z').toISOString(),
      },
    });
    expect(tripRes.statusCode).toBe(201);
    const tripId = (JSON.parse(tripRes.body) as { id: string }).id;

    // Use the stub itinerary generator so we don't depend on an LLM.
    const genRes = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/itinerary`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect([200, 201]).toContain(genRes.statusCode);

    // Stub doesn't create items, so we add a single item directly via
    // the day-edit route — exercising the same code path real users
    // exercise from /trips/[id].
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${tripId}/itinerary`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(listRes.statusCode).toBe(200);
    const days = (JSON.parse(listRes.body) as { days: Array<{ id: string }> }).days;
    expect(days.length).toBeGreaterThan(0);
    const dayId = days[0]!.id;

    const editRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/trips/${tripId}/itinerary/${dayId}`,
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      payload: { items: [{ position: 1, notes: 'morning walk' }] },
    });
    expect(editRes.statusCode).toBe(200);
    const day = (JSON.parse(editRes.body) as { day: { items: Array<{ id: string }> } }).day;
    expect(day.items.length).toBe(1);
    return { tripId, itemId: day.items[0]!.id };
  }

  it('round-trip: complete then uncomplete sets + clears completedAt', async () => {
    const { accessToken } = await registerUser('round');
    const { itemId } = await createTripWithItem(accessToken);

    const completed = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/items/${itemId}/complete`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(completed.statusCode).toBe(200);
    const completedBody = JSON.parse(completed.body) as { id: string; completedAt: string | null };
    expect(completedBody.id).toBe(itemId);
    expect(completedBody.completedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);

    const cleared = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/items/${itemId}/uncomplete`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(cleared.statusCode).toBe(200);
    expect((JSON.parse(cleared.body) as { completedAt: string | null }).completedAt).toBeNull();
  });

  it('IDOR: another user marking the same item complete gets 404 ITEM_NOT_FOUND', async () => {
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');
    const { itemId } = await createTripWithItem(alice.accessToken);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/items/${itemId}/complete`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('ITEM_NOT_FOUND');
  });

  it('missing itemId → 404 ITEM_NOT_FOUND', async () => {
    const { accessToken } = await registerUser('missing');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips/items/does-not-exist/complete',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('ITEM_NOT_FOUND');
  });

  it('unauthenticated → 401 UNAUTHENTICATED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips/items/whatever/complete',
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });
});
