/**
 * Integration tests for the `media` section of `GET /trips/:id/overview`
 * ([IV.18.12.10]).
 *
 * Adds a 7th section to the per-section graceful-degradation
 * pattern. The trip-overview surface now includes
 * `media: { count, recent[] }` so a mobile client can render the
 * trip-detail screen + thumbnail strip in one round-trip.
 *
 * Verifies:
 *   1. Trip with no attached media → media section ok:true,
 *      `count: 0`, `recent: []`.
 *   2. Trip with N attached ready media → count=N, recent[0..min(N,12)]
 *      sorted desc by createdAt.
 *   3. Cross-user isolation: Bob's trip overview does NOT see
 *      Alice's media.
 *   4. Recent list is capped at 12 — additional rows still
 *      contribute to `count`.
 *
 * Installed by prompt [IV.18.12.10].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';

const TEST_PREFIX = 'overview-media-e2e';
// Suite-local Pacific coord — keeps parallel suites independent.
const COORD = { lat: 21.3069, lng: -157.8583 };

interface OverviewBody {
  trip: { id: string };
  media: {
    ok: boolean;
    code?: string;
    data?: {
      count: number;
      recent: Array<{
        id: string;
        kind: string;
        s3KeyRaw: string;
        createdAt: string;
      }>;
    };
  };
}

describe('GET /trips/:id/overview — media section ([IV.18.12.10])', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let infraReachable = true;

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
      console.warn(`overview-media test: infra not reachable (${message}). Skipping.`);
      infraReachable = false;
    }
  });

  afterEach(async () => {
    if (!infraReachable) return;
    // User cascade-deletes Trip + MediaAsset rows.
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
  });

  afterAll(async () => {
    if (infraReachable) await app.close();
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

  /**
   * Seed N ready MediaAsset rows attached to a trip. We bypass the
   * full upload→confirm flow because this test only exercises the
   * read aggregator — the upload flow is covered by media.e2e-spec
   * + media-attach-trip.e2e-spec.
   */
  async function seedTripMedia(
    ownerId: string,
    tripId: string,
    n: number,
    suffix: string,
  ): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const row = await prisma.mediaAsset.create({
        data: {
          ownerId,
          tripId,
          kind: 'image',
          status: 'ready',
          s3KeyRaw: `${TEST_PREFIX}/${suffix}/${i}-${Date.now()}-${Math.random()}`,
        },
      });
      ids.push(row.id);
      // 5ms gap so createdAt strictly orders the rows.
      await new Promise((r) => setTimeout(r, 5));
    }
    return ids;
  }

  async function getOverview(token: string, tripId: string): Promise<OverviewBody> {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${tripId}/overview`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    return JSON.parse(res.body) as OverviewBody;
  }

  it('trip with no attached media → media section ok:true, count=0, recent=[]', async () => {
    if (!infraReachable) return;
    const { accessToken } = await registerUser('empty');
    const tripId = await createTrip(accessToken);

    const body = await getOverview(accessToken, tripId);
    expect(body.media.ok).toBe(true);
    expect(body.media.data!.count).toBe(0);
    expect(body.media.data!.recent).toEqual([]);
  });

  it('trip with 3 attached media → count=3, recent has 3, sorted desc by createdAt', async () => {
    if (!infraReachable) return;
    const { userId, accessToken } = await registerUser('rich');
    const tripId = await createTrip(accessToken);
    const ids = await seedTripMedia(userId, tripId, 3, 'rich');

    const body = await getOverview(accessToken, tripId);
    expect(body.media.ok).toBe(true);
    expect(body.media.data!.count).toBe(3);
    expect(body.media.data!.recent).toHaveLength(3);
    // Most-recent-first: the last seeded row (ids[2]) appears first.
    expect(body.media.data!.recent[0]!.id).toBe(ids[2]);
    expect(body.media.data!.recent[2]!.id).toBe(ids[0]);
  });

  it('cross-user isolation: Bob’s overview never sees Alice’s media', async () => {
    if (!infraReachable) return;
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');
    const aliceTrip = await createTrip(alice.accessToken);
    const bobTrip = await createTrip(bob.accessToken);

    await seedTripMedia(alice.userId, aliceTrip, 5, 'alice');
    await seedTripMedia(bob.userId, bobTrip, 2, 'bob');

    const aliceOverview = await getOverview(alice.accessToken, aliceTrip);
    const bobOverview = await getOverview(bob.accessToken, bobTrip);

    expect(aliceOverview.media.data!.count).toBe(5);
    expect(bobOverview.media.data!.count).toBe(2);
    // Sanity — neither user's recent[] contains rows owned by the other.
    for (const row of aliceOverview.media.data!.recent) {
      const dbRow = await prisma.mediaAsset.findUnique({ where: { id: row.id } });
      expect(dbRow!.ownerId).toBe(alice.userId);
    }
    for (const row of bobOverview.media.data!.recent) {
      const dbRow = await prisma.mediaAsset.findUnique({ where: { id: row.id } });
      expect(dbRow!.ownerId).toBe(bob.userId);
    }
  });

  it('recent list capped at 12 — additional rows still counted', async () => {
    if (!infraReachable) return;
    const { userId, accessToken } = await registerUser('capped');
    const tripId = await createTrip(accessToken);
    await seedTripMedia(userId, tripId, 15, 'capped');

    const body = await getOverview(accessToken, tripId);
    expect(body.media.data!.count).toBe(15);
    expect(body.media.data!.recent).toHaveLength(12);
  });
});
