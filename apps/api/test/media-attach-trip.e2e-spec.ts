/**
 * Integration tests for media × trip attachment ([IV.18.12.2]).
 *
 *   PATCH /api/v1/media/:id/trip        — attach / detach.
 *   GET   /api/v1/media/trip/:tripId    — list mine for a trip.
 *
 * Exercises the double owner-gate (media owner + trip owner) via
 * real Postgres + MinIO. The happy-path flow reuses the same
 * upload → confirm flow from [IV.18.12.1]'s suite so we get a
 * `ready`-status asset to attach (listTripMedia filters out
 * `processing`).
 *
 * Installed by prompt [IV.18.12.2].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'media-attach-e2e';
const TRIP_CENTER = { lat: 33.1234, lng: -66.5678 };

describe('Media × Trip attachment (integration, requires Postgres + MinIO)', () => {
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
    // MinIO must be reachable so the upload → confirm flow works.
    const probe = await fetch(`${process.env['S3_ENDPOINT']}/`);
    if (probe.status >= 500) throw new Error(`MinIO probe ${probe.status}`);
  });

  afterEach(async () => {
    // User cascade-deletes MediaAsset (via ownerId FK) + Trip (via
    // userId FK).
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
        center: TRIP_CENTER,
        radiusKm: 5,
      },
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { id: string }).id;
  }

  async function uploadReadyMedia(token: string): Promise<string> {
    const contentType = 'image/png';
    const urlRes = await app.inject({
      method: 'POST',
      url: '/api/v1/media/upload-url',
      headers: { authorization: `Bearer ${token}` },
      payload: { kind: 'image', contentType },
    });
    expect(urlRes.statusCode).toBe(201);
    const { mediaAssetId, uploadUrl } = JSON.parse(urlRes.body) as {
      mediaAssetId: string;
      uploadUrl: string;
    };
    const put = await fetch(uploadUrl, {
      method: 'PUT',
      body: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      headers: { 'content-type': contentType },
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

  it('happy path: attach → tripId set → GET /trip/:tripId lists it → detach clears it', async () => {
    const { accessToken } = await registerUser('happy');
    const tripId = await createTrip(accessToken);
    const mediaId = await uploadReadyMedia(accessToken);

    // Attach.
    const attach = await app.inject({
      method: 'PATCH',
      url: `/api/v1/media/${mediaId}/trip`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { tripId },
    });
    expect(attach.statusCode).toBe(200);
    expect(JSON.parse(attach.body).tripId).toBe(tripId);

    // List shows it.
    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/media/trip/${tripId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(list.statusCode).toBe(200);
    const body = JSON.parse(list.body) as { media: Array<{ id: string; tripId: string | null }> };
    expect(body.media).toHaveLength(1);
    expect(body.media[0]!.id).toBe(mediaId);
    expect(body.media[0]!.tripId).toBe(tripId);

    // Detach.
    const detach = await app.inject({
      method: 'PATCH',
      url: `/api/v1/media/${mediaId}/trip`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { tripId: null },
    });
    expect(detach.statusCode).toBe(200);
    expect(JSON.parse(detach.body).tripId).toBeNull();

    // List no longer shows it.
    const list2 = await app.inject({
      method: 'GET',
      url: `/api/v1/media/trip/${tripId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const body2 = JSON.parse(list2.body) as { media: unknown[] };
    expect(body2.media).toEqual([]);
  });

  it('attach to another user’s trip → 404 TRIP_NOT_FOUND (IDOR defence)', async () => {
    const alice = await registerUser('a-idor-trip');
    const bob = await registerUser('b-idor-trip');
    const aliceTripId = await createTrip(alice.accessToken);
    const bobMediaId = await uploadReadyMedia(bob.accessToken);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/media/${bobMediaId}/trip`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: { tripId: aliceTripId },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('TRIP_NOT_FOUND');
  });

  it('attach another user’s media → 404 MEDIA_NOT_FOUND (IDOR defence)', async () => {
    const alice = await registerUser('a-idor-media');
    const bob = await registerUser('b-idor-media');
    const aliceMediaId = await uploadReadyMedia(alice.accessToken);
    const bobTripId = await createTrip(bob.accessToken);

    // Bob tries to attach Alice's media to his own trip.
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/media/${aliceMediaId}/trip`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: { tripId: bobTripId },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('MEDIA_NOT_FOUND');
  });

  it('GET /media/trip/:tripId on another user’s trip → 404 TRIP_NOT_FOUND', async () => {
    const alice = await registerUser('a-list');
    const bob = await registerUser('b-list');
    const aliceTripId = await createTrip(alice.accessToken);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/media/trip/${aliceTripId}`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('TRIP_NOT_FOUND');
  });

  it('processing-status media is NOT listed by GET /media/trip/:tripId', async () => {
    const { accessToken } = await registerUser('noproc');
    const tripId = await createTrip(accessToken);

    // Request upload URL but do NOT put bytes + do NOT confirm —
    // row stays in `processing`.
    const urlRes = await app.inject({
      method: 'POST',
      url: '/api/v1/media/upload-url',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { kind: 'image', contentType: 'image/png' },
    });
    const { mediaAssetId } = JSON.parse(urlRes.body) as { mediaAssetId: string };

    // Attach the processing asset.
    const attach = await app.inject({
      method: 'PATCH',
      url: `/api/v1/media/${mediaAssetId}/trip`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { tripId },
    });
    expect(attach.statusCode).toBe(200);

    // Listing still returns empty — processing rows are filtered.
    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/media/trip/${tripId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(list.statusCode).toBe(200);
    expect((JSON.parse(list.body) as { media: unknown[] }).media).toEqual([]);
  });

  it('detach is always allowed on own media (even if currently unattached)', async () => {
    const { accessToken } = await registerUser('detach');
    const mediaId = await uploadReadyMedia(accessToken);

    // Media starts with tripId=null; re-detaching is a no-op success.
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/media/${mediaId}/trip`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { tripId: null },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).tripId).toBeNull();
  });

  it('PATCH without body → 422 VALIDATION_FAILED (Zod requires tripId key)', async () => {
    const { accessToken } = await registerUser('novalid');
    const mediaId = await uploadReadyMedia(accessToken);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/media/${mediaId}/trip`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });
});
