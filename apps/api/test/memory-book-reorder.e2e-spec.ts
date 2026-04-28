/**
 * V.UX.12 — drag-reorder of memory-book assets via
 * `PATCH /memory-books/:id/asset-order`. Owner-gated; the request
 * body must be a strict permutation of the currently-attached
 * `ready` assets. Verifies the persisted ordering shows up in the
 * subsequent `GET /memory-books/:id` and the public viewer.
 *
 * Installed by prompt [V.UX.12].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';

const TEST_PREFIX = 'mem-book-reorder-e2e';

interface BookResp {
  readonly id: string;
}

interface AssetSummary {
  readonly id: string;
  readonly position: number;
}

describe('Memory Book reorder (V.UX.12 — integration, requires Postgres + MinIO)', () => {
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
      console.warn(`memory-book-reorder test: infra not reachable (${message}). Skipping.`);
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

  async function createBookWithAssets(token: string, suffix: string, count: number) {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/memory-books',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: `${TEST_PREFIX}-${suffix}` },
    });
    expect(create.statusCode).toBe(201);
    const bookId = (JSON.parse(create.body) as BookResp).id;

    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const mediaId = await uploadReadyMedia(token);
      const attach = await app.inject({
        method: 'PATCH',
        url: `/api/v1/media/${mediaId}/memory-book`,
        headers: { authorization: `Bearer ${token}` },
        payload: { memoryBookId: bookId },
      });
      expect(attach.statusCode).toBe(200);
      ids.push(mediaId);
    }
    return { bookId, ids };
  }

  it('reorders assets and persists new positions in subsequent GET', async () => {
    if (!infraReachable) return;
    const { accessToken } = await registerUser('happy');
    const { bookId, ids } = await createBookWithAssets(accessToken, 'happy', 3);

    // Reverse the order.
    const reversed = [...ids].reverse();
    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/memory-books/${bookId}/asset-order`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { assetIds: reversed },
    });
    expect(patch.statusCode).toBe(204);

    const get = await app.inject({
      method: 'GET',
      url: `/api/v1/memory-books/${bookId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(get.statusCode).toBe(200);
    const body = JSON.parse(get.body) as { assets: AssetSummary[] };
    const orderedIds = body.assets.map((a) => a.id);
    expect(orderedIds).toEqual(reversed);
    // positions are 0..n-1, in order.
    expect(body.assets.map((a) => a.position)).toEqual([0, 1, 2]);
  });

  it('public viewer reflects the same ordering after publish', async () => {
    if (!infraReachable) return;
    const { accessToken } = await registerUser('public');
    const { bookId, ids } = await createBookWithAssets(accessToken, 'public', 2);

    const reversed = [...ids].reverse();
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/memory-books/${bookId}/asset-order`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { assetIds: reversed },
    });

    await app.inject({
      method: 'POST',
      url: `/api/v1/memory-books/${bookId}/publish`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    const pub = await app.inject({
      method: 'GET',
      url: `/api/v1/memory-books/public/${bookId}`,
    });
    expect(pub.statusCode).toBe(200);
    const body = JSON.parse(pub.body) as { assets: AssetSummary[] };
    expect(body.assets.map((a) => a.id)).toEqual(reversed);
  });

  it('reorder list with duplicates → 422 INVALID_ASSET_ORDER', async () => {
    if (!infraReachable) return;
    const { accessToken } = await registerUser('dup');
    const { bookId, ids } = await createBookWithAssets(accessToken, 'dup', 2);

    const dup = [ids[0]!, ids[0]!];
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/memory-books/${bookId}/asset-order`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { assetIds: dup },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('INVALID_ASSET_ORDER');
  });

  it('reorder list missing an attached asset → 422 INVALID_ASSET_ORDER', async () => {
    if (!infraReachable) return;
    const { accessToken } = await registerUser('miss');
    const { bookId, ids } = await createBookWithAssets(accessToken, 'miss', 3);

    // Drop one — length mismatch.
    const partial = ids.slice(0, 2);
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/memory-books/${bookId}/asset-order`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { assetIds: partial },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('INVALID_ASSET_ORDER');
  });

  it('reorder targeting another user’s book → 404 MEMORY_BOOK_NOT_FOUND', async () => {
    if (!infraReachable) return;
    const alice = await registerUser('a');
    const bob = await registerUser('b');
    const { bookId, ids } = await createBookWithAssets(alice.accessToken, 'a', 2);
    const reversed = [...ids].reverse();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/memory-books/${bookId}/asset-order`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: { assetIds: reversed },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('MEMORY_BOOK_NOT_FOUND');
  });

  it('without bearer → 401', async () => {
    if (!infraReachable) return;
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/memory-books/abc/asset-order',
      payload: { assetIds: ['a'] },
    });
    expect(res.statusCode).toBe(401);
  });
});
