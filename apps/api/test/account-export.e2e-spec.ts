/**
 * Integration tests for `GET /account/export` ([IV.18.16.1]).
 *
 * GDPR Art. 15 / DPDP §11 / COPPA "give me my data" surface.
 * Verifies that the bundle:
 *
 *   - 401s without a bearer.
 *   - Returns all empty section arrays for a freshly-registered
 *     user (Identity is the only populated section, since
 *     registration creates the User row + a Session).
 *   - Returns every user-attributable row for a "rich user" who
 *     has created a trip, a scam report, a media asset, a memory
 *     book, and notification logs.
 *   - Cross-user isolation: Bob's bundle never includes Alice's
 *     rows even when both seed similar shapes.
 *   - Includes `metadata.exportedAt` + `metadata.formatVersion: 1`.
 *
 * Installed by prompt [IV.18.16.1].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';

const TEST_PREFIX = 'account-export-e2e';
// Suite-local coords — keep distinct from any other safety/trip suite
// running in parallel (see `feedback_unique_test_coords.md`).
const COORD = { lat: 40.7128, lng: -74.006 };

interface ExportBody {
  metadata: { exportedAt: string; formatVersion: number; userId: string };
  identity: {
    user: { id: string; emailHash: string; displayName: string };
    sessions: { count: number; rows: Array<{ id: string }> };
  };
  trips: { count: number; rows: Array<{ id: string; title: string }> };
  scamReports: { count: number; rows: Array<{ id: string; category: string }> };
  mediaAssets: { count: number; rows: Array<{ id: string }> };
  memoryBooks: { count: number; rows: Array<{ id: string; title: string }> };
  notificationLogs: { count: number; rows: Array<{ id: string; templateId: string }> };
  votes: { count: number; rows: unknown[] };
  expenses: { count: number; rows: unknown[] };
  reviews: { count: number; rows: unknown[] };
  itineraryDays: { count: number; rows: unknown[] };
  itineraryItems: { count: number; rows: unknown[] };
  tripVersions: { count: number; rows: unknown[] };
  tripShares: { count: number; rows: unknown[] };
  sosEvents: { count: number; rows: unknown[] };
  dishReports: { count: number; rows: unknown[] };
  stayBookings: { count: number; rows: unknown[] };
  subscriptions: { count: number; rows: unknown[] };
  escrowHolds: { count: number; rows: unknown[] };
  commissions: { count: number; rows: unknown[] };
  liveEvents: { count: number; rows: unknown[] };
  agentProfile: unknown;
  notificationPreference: unknown;
}

describe('GET /account/export (integration, requires Postgres + MinIO)', () => {
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
      const probe = await fetch(`${process.env['S3_ENDPOINT']}/`);
      if (probe.status >= 500) throw new Error(`MinIO probe ${probe.status}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`account-export test: infra not reachable (${message}). Skipping.`);
      infraReachable = false;
    }
  });

  afterEach(async () => {
    if (!infraReachable) return;
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

  async function getExport(token: string): Promise<{ status: number; body: ExportBody }> {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/account/export',
      headers: { authorization: `Bearer ${token}` },
    });
    return { status: res.statusCode, body: JSON.parse(res.body) as ExportBody };
  }

  async function createTrip(token: string, title: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${token}` },
      payload: { title, center: COORD, radiusKm: 5 },
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { id: string }).id;
  }

  async function createScamReport(token: string): Promise<void> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/scam-reports',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        center: { lat: COORD.lat + 0.001, lng: COORD.lng + 0.001 },
        category: 'pickpocket',
        severity: 'medium',
        description: 'Account-export test scam report.',
      },
    });
    expect(res.statusCode).toBe(201);
  }

  async function uploadReadyMedia(token: string): Promise<string> {
    const urlRes = await app.inject({
      method: 'POST',
      url: '/api/v1/media/upload-url',
      headers: { authorization: `Bearer ${token}` },
      payload: { kind: 'image', contentType: 'image/png' },
    });
    expect(urlRes.statusCode).toBe(201);
    const { mediaAssetId, uploadUrl } = JSON.parse(urlRes.body) as {
      mediaAssetId: string;
      uploadUrl: string;
    };
    const put = await fetch(uploadUrl, {
      method: 'PUT',
      body: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      headers: { 'content-type': 'image/png' },
    });
    expect(put.status).toBe(200);
    const confirm = await app.inject({
      method: 'POST',
      url: `/api/v1/media/${mediaAssetId}/confirm`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(confirm.statusCode).toBe(200);
    return mediaAssetId;
  }

  async function createMemoryBook(token: string, title: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/memory-books',
      headers: { authorization: `Bearer ${token}` },
      payload: { title },
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { id: string }).id;
  }

  // ─── Tests ──────────────────────────────────────────────────────────

  it('GET /account/export without bearer → 401', async () => {
    if (!infraReachable) return;
    const res = await app.inject({ method: 'GET', url: '/api/v1/account/export' });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('empty user → 200; only Identity is populated, every other section is `{ count: 0, rows: [] }`', async () => {
    if (!infraReachable) return;
    const { userId, accessToken } = await registerUser('empty');

    const { status, body } = await getExport(accessToken);
    expect(status).toBe(200);

    // Metadata.
    expect(body.metadata.userId).toBe(userId);
    expect(body.metadata.formatVersion).toBe(1);
    expect(typeof body.metadata.exportedAt).toBe('string');
    expect(new Date(body.metadata.exportedAt).getTime()).toBeGreaterThan(0);

    // Identity present.
    expect(body.identity.user.id).toBe(userId);
    expect(body.identity.user.emailHash).toMatch(/^[0-9a-f]+$/i);
    // Registration mints a session.
    expect(body.identity.sessions.count).toBeGreaterThanOrEqual(1);

    // Every other section empty.
    const emptySections = [
      body.trips,
      body.itineraryDays,
      body.itineraryItems,
      body.tripVersions,
      body.tripShares,
      body.scamReports,
      body.sosEvents,
      body.mediaAssets,
      body.memoryBooks,
      body.votes,
      body.expenses,
      body.reviews,
      body.dishReports,
      body.stayBookings,
      body.subscriptions,
      body.escrowHolds,
      body.commissions,
      body.liveEvents,
    ];
    for (const s of emptySections) {
      expect(s.count).toBe(0);
      expect(s.rows).toEqual([]);
    }
    // Notification log: registration triggers `session_issued_new_device`.
    expect(body.notificationLogs.count).toBeGreaterThanOrEqual(1);
    expect(body.notificationLogs.rows[0]!.templateId).toBe('session_issued_new_device');
    // Optional surfaces — null when no agent profile / no preference row.
    expect(body.agentProfile).toBeNull();
    // NotificationPreference may be null (default behaviour) — can't assert one way.
  });

  it('rich user → bundle contains every authored row', async () => {
    if (!infraReachable) return;
    const { userId, accessToken } = await registerUser('rich');

    const tripId = await createTrip(accessToken, 'rich-trip');
    await createScamReport(accessToken);
    const mediaId = await uploadReadyMedia(accessToken);
    const bookId = await createMemoryBook(accessToken, 'rich-book');

    const { status, body } = await getExport(accessToken);
    expect(status).toBe(200);
    expect(body.metadata.userId).toBe(userId);

    // Trip.
    expect(body.trips.count).toBe(1);
    expect(body.trips.rows[0]!.id).toBe(tripId);
    expect(body.trips.rows[0]!.title).toBe('rich-trip');

    // Scam report.
    expect(body.scamReports.count).toBe(1);
    expect(body.scamReports.rows[0]!.category).toBe('pickpocket');

    // Media + memory book.
    expect(body.mediaAssets.count).toBe(1);
    expect(body.mediaAssets.rows[0]!.id).toBe(mediaId);
    expect(body.memoryBooks.count).toBe(1);
    expect(body.memoryBooks.rows[0]!.id).toBe(bookId);

    // Notification logs include the registration-time row.
    expect(body.notificationLogs.count).toBeGreaterThanOrEqual(1);
  });

  it('cross-user IDOR: Bob’s export contains zero of Alice’s rows', async () => {
    if (!infraReachable) return;
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');

    // Alice seeds rich data; Bob stays empty.
    await createTrip(alice.accessToken, 'alice-trip');
    await createScamReport(alice.accessToken);
    await uploadReadyMedia(alice.accessToken);
    await createMemoryBook(alice.accessToken, 'alice-book');

    const { status, body: bobBody } = await getExport(bob.accessToken);
    expect(status).toBe(200);
    expect(bobBody.metadata.userId).toBe(bob.userId);

    expect(bobBody.trips.count).toBe(0);
    expect(bobBody.scamReports.count).toBe(0);
    expect(bobBody.mediaAssets.count).toBe(0);
    expect(bobBody.memoryBooks.count).toBe(0);

    // Sanity: Alice's bundle DOES contain her data.
    const aliceExport = await getExport(alice.accessToken);
    expect(aliceExport.body.trips.count).toBe(1);
    expect(aliceExport.body.scamReports.count).toBe(1);
    expect(aliceExport.body.mediaAssets.count).toBe(1);
    expect(aliceExport.body.memoryBooks.count).toBe(1);
    // And Alice's user.id is what's in her bundle.
    expect(aliceExport.body.identity.user.id).toBe(alice.userId);
  });

  it('itinerary fan-out: trip with generated itinerary → days present in bundle', async () => {
    if (!infraReachable) return;
    const { accessToken } = await registerUser('itin');

    // Create trip with dates so itinerary generation produces day rows.
    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: 'itin-trip',
        center: COORD,
        radiusKm: 5,
        startsOn: '2026-09-01',
        endsOn: '2026-09-03',
      },
    });
    expect(tripRes.statusCode).toBe(201);
    const tripId = (JSON.parse(tripRes.body) as { id: string }).id;

    const itinRes = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/itinerary`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(itinRes.statusCode).toBe(200);

    const { body } = await getExport(accessToken);
    // 3 dates → 3 itinerary days.
    expect(body.itineraryDays.count).toBe(3);
    // Items list intentionally untouched — empty is the right v1 shape.
    expect(body.itineraryItems.count).toBe(0);
  });
});
