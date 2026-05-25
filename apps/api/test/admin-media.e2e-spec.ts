/**
 * Integration tests for the admin media moderation surface
 * ([IV.18.18.4]).
 *
 *   GET    /admin/media?ownerId=&kind=&status=&limit=&offset=
 *   DELETE /admin/media/:id
 *
 * Cross-user list (admin sees ALL users' media). Hard-delete with
 * SetNull cascades on Trip + MemoryBook attachment FKs.
 *
 * Tests seed MediaAsset rows directly via Prisma — the upload→
 * confirm flow is covered by media.e2e-spec; these tests focus
 * on the moderation surface behavior.
 *
 * Installed by prompt [IV.18.18.4].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail, uniqueSuffix } from './factories';

const TEST_PREFIX = 'admin-media-e2e';
const COORD = { lat: 37.7749, lng: -122.4194 };

interface MediaResp {
  id: string;
  ownerId: string;
  tripId: string | null;
  kind: string;
  status: string;
  s3KeyRaw: string;
}

interface ListResp {
  media: MediaResp[];
  total: number;
}

describe('Admin media moderation (integration, requires Docker Postgres)', () => {
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

  async function registerUser(suffix: string): Promise<{
    userId: string;
    accessToken: string;
    email: string;
    password: string;
  }> {
    const email = uniqueEmail(`${TEST_PREFIX}-${suffix}`);
    const password = 'correct-horse-battery-staple';
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password, displayName: `${TEST_PREFIX}-${suffix}` },
    });
    expect(res.statusCode).toBe(201);
    return {
      ...(JSON.parse(res.body) as { userId: string; accessToken: string }),
      email,
      password,
    };
  }

  async function loginAsAdmin(suffix: string): Promise<string> {
    const reg = await registerUser(suffix);
    await prisma.user.update({ where: { id: reg.userId }, data: { role: 'admin' } });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: reg.email, password: reg.password },
    });
    expect(login.statusCode).toBe(200);
    return (JSON.parse(login.body) as { accessToken: string }).accessToken;
  }

  async function seedMedia(
    ownerId: string,
    suffix: string,
    overrides: { kind?: 'image' | 'video'; status?: 'processing' | 'ready' | 'failed' } = {},
  ): Promise<string> {
    const row = await prisma.mediaAsset.create({
      data: {
        ownerId,
        kind: overrides.kind ?? 'image',
        status: overrides.status ?? 'ready',
        s3KeyRaw: `${TEST_PREFIX}/${suffix}/${uniqueSuffix()}`,
      },
    });
    return row.id;
  }

  async function adminList(token: string, query = ''): Promise<ListResp> {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/media${query}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    return JSON.parse(res.body) as ListResp;
  }

  it('GET /admin/media without bearer → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/media' });
    expect(res.statusCode).toBe(401);
  });

  it('non-admin → 403', async () => {
    const { accessToken } = await registerUser('non-admin');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/media',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('admin list cross-user with ?ownerId filter narrows to that user', async () => {
    const adminToken = await loginAsAdmin('list-admin');
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');
    const aliceMedia = await seedMedia(alice.userId, 'a-img');
    await seedMedia(bob.userId, 'b-img');

    const body = await adminList(adminToken, `?ownerId=${alice.userId}`);
    expect(body.media.length).toBeGreaterThanOrEqual(1);
    for (const m of body.media) expect(m.ownerId).toBe(alice.userId);
    expect(body.media.some((m) => m.id === aliceMedia)).toBe(true);
  });

  it('?kind=image filters by kind', async () => {
    const adminToken = await loginAsAdmin('kind-admin');
    const u = await registerUser('kind-target');
    await seedMedia(u.userId, 'img', { kind: 'image' });
    await seedMedia(u.userId, 'vid', { kind: 'video' });

    const body = await adminList(adminToken, `?kind=image&ownerId=${u.userId}`);
    expect(body.media.length).toBeGreaterThanOrEqual(1);
    for (const m of body.media) expect(m.kind).toBe('image');
  });

  it('?status=processing filters by status', async () => {
    const adminToken = await loginAsAdmin('status-admin');
    const u = await registerUser('status-target');
    const procId = await seedMedia(u.userId, 'pending', { status: 'processing' });
    await seedMedia(u.userId, 'done', { status: 'ready' });

    const body = await adminList(adminToken, `?status=processing&ownerId=${u.userId}`);
    expect(body.media.length).toBeGreaterThanOrEqual(1);
    expect(body.media.some((m) => m.id === procId)).toBe(true);
    for (const m of body.media) expect(m.status).toBe('processing');
  });

  it('admin delete: row gone; attached trip survives via SetNull', async () => {
    const adminToken = await loginAsAdmin('delete-admin');
    const u = await registerUser('delete-target');
    // Trip via API (PostGIS).
    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${u.accessToken}` },
      payload: { title: `${TEST_PREFIX}-delete-trip`, center: COORD, radiusKm: 5 },
    });
    expect(tripRes.statusCode).toBe(201);
    const tripId = (JSON.parse(tripRes.body) as { id: string }).id;
    // Media row attached to the trip.
    const mediaRow = await prisma.mediaAsset.create({
      data: {
        ownerId: u.userId,
        tripId,
        kind: 'image',
        status: 'ready',
        s3KeyRaw: `${TEST_PREFIX}/delete-with-trip/${uniqueSuffix()}`,
      },
    });

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/media/${mediaRow.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(del.statusCode).toBe(204);

    // Media row gone.
    expect(await prisma.mediaAsset.findUnique({ where: { id: mediaRow.id } })).toBeNull();
    // Trip row survives (SetNull cascade — the trip's mediaCount is just 0 now).
    expect(await prisma.trip.findUnique({ where: { id: tripId } })).not.toBeNull();
  });

  it('admin delete on missing id → 404 MEDIA_NOT_FOUND', async () => {
    const adminToken = await loginAsAdmin('delete-404');
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/admin/media/does-not-exist',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('MEDIA_NOT_FOUND');
  });

  it('unknown kind / status param → 400 VALIDATION_FAILED', async () => {
    const adminToken = await loginAsAdmin('bad-filter');
    const k = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/media?kind=bogus',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(k.statusCode).toBe(400);
    expect(JSON.parse(k.body).code).toBe('VALIDATION_FAILED');

    const s = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/media?status=bogus',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(s.statusCode).toBe(400);
    expect(JSON.parse(s.body).code).toBe('VALIDATION_FAILED');
  });

  it('non-admin caller can’t delete', async () => {
    const attacker = await registerUser('attacker');
    const target = await registerUser('victim');
    const mediaId = await seedMedia(target.userId, 'untouched');

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/media/${mediaId}`,
      headers: { authorization: `Bearer ${attacker.accessToken}` },
    });
    expect(res.statusCode).toBe(403);

    expect(await prisma.mediaAsset.findUnique({ where: { id: mediaId } })).not.toBeNull();
  });
});
