/**
 * Integration test for the EXIF-strip stub on confirm-upload
 * ([IV.18.12.14]).
 *
 * Behavior contract:
 *   - Image upload → confirm flips `status: ready` AND
 *     `exifStripped: true`.
 *   - Video upload → confirm flips `status: ready` but leaves
 *     `exifStripped: false` (videos defer to `media-service`).
 *   - Idempotent: re-confirming an image leaves the flag true.
 *
 * The flag is a stub. The byte-level strip-then-reupload runs
 * out-of-band in `media-service` per playbook §3.2; this slice
 * just lays the gate so location/EXIF features can refuse to
 * surface raw data until the worker has run.
 *
 * Installed by prompt [IV.18.12.14].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'media-exif-e2e';

describe('Media EXIF-strip stub on confirm (integration, requires Docker Postgres + MinIO)', () => {
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
    const probe = await fetch(`${process.env['S3_ENDPOINT']}/`).catch((err) => {
      throw err;
    });
    if (probe.status >= 500) throw new Error(`MinIO probe returned ${probe.status}`);
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

  async function uploadAndConfirm(
    token: string,
    kind: 'image' | 'video',
  ): Promise<{ mediaAssetId: string }> {
    const urlRes = await app.inject({
      method: 'POST',
      url: '/api/v1/media/upload-url',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        kind,
        contentType: kind === 'image' ? 'image/png' : 'video/mp4',
      },
    });
    expect(urlRes.statusCode).toBe(201);
    const { mediaAssetId, uploadUrl } = JSON.parse(urlRes.body) as {
      mediaAssetId: string;
      uploadUrl: string;
    };

    const put = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': kind === 'image' ? 'image/png' : 'video/mp4' },
      body: 'test-bytes',
    });
    expect(put.ok).toBe(true);

    const confirm = await app.inject({
      method: 'POST',
      url: `/api/v1/media/${mediaAssetId}/confirm`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(confirm.statusCode).toBe(200);
    return { mediaAssetId };
  }

  it('image confirm → exifStripped flips to true', async () => {
    const u = await registerUser('image');
    const { mediaAssetId } = await uploadAndConfirm(u.accessToken, 'image');
    const row = await prisma.mediaAsset.findUnique({ where: { id: mediaAssetId } });
    expect(row).not.toBeNull();
    expect(row!.status).toBe('ready');
    expect(row!.exifStripped).toBe(true);
  });

  it('video confirm → exifStripped stays false (worker defers)', async () => {
    const u = await registerUser('video');
    const { mediaAssetId } = await uploadAndConfirm(u.accessToken, 'video');
    const row = await prisma.mediaAsset.findUnique({ where: { id: mediaAssetId } });
    expect(row).not.toBeNull();
    expect(row!.status).toBe('ready');
    expect(row!.exifStripped).toBe(false);
  });

  it('idempotent: re-confirming an image leaves exifStripped=true', async () => {
    const u = await registerUser('idemp');
    const { mediaAssetId } = await uploadAndConfirm(u.accessToken, 'image');
    // Re-confirm — already-ready short-circuit; flag stays true.
    const second = await app.inject({
      method: 'POST',
      url: `/api/v1/media/${mediaAssetId}/confirm`,
      headers: { authorization: `Bearer ${u.accessToken}` },
    });
    expect(second.statusCode).toBe(200);
    const row = await prisma.mediaAsset.findUnique({ where: { id: mediaAssetId } });
    expect(row!.exifStripped).toBe(true);
  });
});
