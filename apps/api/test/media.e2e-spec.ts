/**
 * Integration tests for the Media module ([IV.18.12.1]).
 *
 * Drives the real `S3StorageProvider` against the `travel-minio`
 * container. The happy path performs an end-to-end presigned
 * upload:
 *
 *   1. POST /media/upload-url  → { uploadUrl, mediaAssetId }
 *   2. PUT <bytes> to `uploadUrl` via native Node fetch (N22+).
 *   3. POST /media/:id/confirm → 200 { status: 'ready' }
 *   4. GET  /media/:id/download-url → 200 { url }
 *   5. GET  <url> → 200 with the bytes that were uploaded.
 *
 * `ensureBucket` on `S3StorageProvider.onModuleInit` creates the
 * `travel-test` bucket if MinIO starts empty, so no external
 * bucket-provisioning step is needed.
 *
 * Installed by prompt [IV.18.12.1].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';

const TEST_PREFIX = 'media-e2e';

describe('Media module (integration, requires Docker Postgres + MinIO)', () => {
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
      // Probe MinIO directly too — the module's ensureBucket
      // tolerates a missing MinIO without throwing, which would
      // otherwise let tests pass `beforeAll` then fail opaquely
      // on the first PUT.
      const probe = await fetch(`${process.env['S3_ENDPOINT']}/`).catch((err) => {
        throw err;
      });
      if (probe.status >= 500) {
        throw new Error(`MinIO probe returned ${probe.status}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`media test: infra not reachable (${message}). Skipping.`);
      infraReachable = false;
    }
  });

  afterEach(async () => {
    if (!infraReachable) return;
    // User cascade-deletes the MediaAsset rows.
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
  });

  afterAll(async () => {
    if (infraReachable) {
      await app.close();
    }
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

  async function requestUploadUrl(
    accessToken: string,
    overrides: Partial<{ kind: string; contentType: string }> = {},
  ): Promise<{
    mediaAssetId: string;
    uploadUrl: string;
    key: string;
    method: 'PUT';
    expiresAt: string;
  }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/media/upload-url',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        kind: overrides.kind ?? 'image',
        contentType: overrides.contentType ?? 'image/png',
      },
    });
    expect(res.statusCode).toBe(201);
    return JSON.parse(res.body);
  }

  it('POST /media/upload-url without a bearer → 401', async () => {
    if (!infraReachable) return;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/media/upload-url',
      payload: { kind: 'image', contentType: 'image/png' },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('happy path: upload-url → PUT bytes → confirm → download → fetch bytes back', async () => {
    if (!infraReachable) return;
    const { accessToken } = await registerUser('happy');

    const contentType = 'image/png';
    const { mediaAssetId, uploadUrl } = await requestUploadUrl(accessToken, { contentType });

    // A fake-but-valid 4-byte payload. MinIO doesn't validate PNG
    // magic — it just stores bytes.
    const body = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const put = await fetch(uploadUrl, {
      method: 'PUT',
      body,
      headers: { 'content-type': contentType },
    });
    expect(put.status).toBe(200);

    const confirm = await app.inject({
      method: 'POST',
      url: `/api/v1/media/${mediaAssetId}/confirm`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    });
    expect(confirm.statusCode).toBe(200);
    expect(JSON.parse(confirm.body).status).toBe('ready');

    const dl = await app.inject({
      method: 'GET',
      url: `/api/v1/media/${mediaAssetId}/download-url`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(dl.statusCode).toBe(200);
    const { url } = JSON.parse(dl.body) as { url: string; expiresAt: string };

    const get = await fetch(url);
    expect(get.status).toBe(200);
    const got = Buffer.from(await get.arrayBuffer());
    expect(got.equals(body)).toBe(true);
  });

  it('confirm before the upload actually happened → 409 UPLOAD_NOT_COMPLETED', async () => {
    if (!infraReachable) return;
    const { accessToken } = await registerUser('nocomplete');
    const { mediaAssetId } = await requestUploadUrl(accessToken);

    const confirm = await app.inject({
      method: 'POST',
      url: `/api/v1/media/${mediaAssetId}/confirm`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    });
    expect(confirm.statusCode).toBe(409);
    expect(JSON.parse(confirm.body).code).toBe('UPLOAD_NOT_COMPLETED');
  });

  it('confirm on another user’s asset → 404 MEDIA_NOT_FOUND (IDOR defence)', async () => {
    if (!infraReachable) return;
    const alice = await registerUser('a-idor');
    const bob = await registerUser('b-idor');
    const { mediaAssetId } = await requestUploadUrl(alice.accessToken);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/media/${mediaAssetId}/confirm`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('MEDIA_NOT_FOUND');
  });

  it('download-url on another user’s asset → 404 MEDIA_NOT_FOUND', async () => {
    if (!infraReachable) return;
    const alice = await registerUser('a-dl');
    const bob = await registerUser('b-dl');
    const contentType = 'image/png';
    const { mediaAssetId, uploadUrl } = await requestUploadUrl(alice.accessToken, { contentType });

    await fetch(uploadUrl, {
      method: 'PUT',
      body: Buffer.from('hello'),
      headers: { 'content-type': contentType },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/media/${mediaAssetId}/confirm`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: {},
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/media/${mediaAssetId}/download-url`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('MEDIA_NOT_FOUND');
  });

  it('invalid kind (e.g. "audio") → 422 VALIDATION_FAILED', async () => {
    if (!infraReachable) return;
    const { accessToken } = await registerUser('badkind');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/media/upload-url',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { kind: 'audio', contentType: 'audio/mpeg' },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });

  it('double-confirm is idempotent — second call still returns ready', async () => {
    if (!infraReachable) return;
    const { accessToken } = await registerUser('double');
    const contentType = 'image/jpeg';
    const { mediaAssetId, uploadUrl } = await requestUploadUrl(accessToken, { contentType });

    await fetch(uploadUrl, {
      method: 'PUT',
      body: Buffer.from('jpeg-bytes'),
      headers: { 'content-type': contentType },
    });

    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/media/${mediaAssetId}/confirm`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    });
    expect(first.statusCode).toBe(200);
    expect(JSON.parse(first.body).status).toBe('ready');

    const second = await app.inject({
      method: 'POST',
      url: `/api/v1/media/${mediaAssetId}/confirm`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    });
    expect(second.statusCode).toBe(200);
    expect(JSON.parse(second.body).status).toBe('ready');
  });
});
