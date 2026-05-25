/**
 * Integration test for the S3 orphan-object sweep
 * (`[IV.18.18.5]`). Companion to `[IV.18.18.4]` admin media
 * moderation, which intentionally leaves S3 bytes behind on
 * hard-delete; this sweep eventually wipes them.
 *
 * Scenarios exercised:
 *   1. An orphan bucket key (no MediaAsset row) → sweep deletes it.
 *   2. A bucket key with a matching MediaAsset row → sweep leaves
 *      it alone.
 *   3. Empty bucket case is implicitly covered when other test
 *      runs leave nothing behind.
 *
 * Because the S3 endpoint here is MinIO via Docker Compose, real
 * presigned PUT/HEAD/DELETE round-trips happen — this is an
 * integration test, not a unit test. The AWS SDK seam uses
 * `getSignedUrl` + native `fetch` (per memory rule
 * `feedback_aws_sdk_jest_vm.md`); no `client.send()` calls.
 *
 * Installed by prompt [IV.18.18.5].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { OrphanS3SweepUseCase } from '../src/modules/media/application/orphan-s3-sweep.use-case';
import { STORAGE_PROVIDER } from '../src/modules/media/application/ports/storage-provider';
import type { StorageProvider } from '../src/modules/media/application/ports/storage-provider';
import { uniqueEmail, uniqueSuffix } from './factories';

const TEST_PREFIX = 'orphan-sweep-e2e';

describe('OrphanS3SweepUseCase (integration, requires Docker MinIO + Postgres)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let storage: StorageProvider;
  let sweepUc: OrphanS3SweepUseCase;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await app.register(fastifyCookie);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = moduleRef.get(PrismaService);
    storage = moduleRef.get<StorageProvider>(STORAGE_PROVIDER);
    sweepUc = moduleRef.get(OrphanS3SweepUseCase);
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

  async function putBytes(key: string): Promise<void> {
    const url = await storage.createPresignedUploadUrl({
      key,
      contentType: 'application/octet-stream',
      expiresSec: 60,
    });
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'content-type': 'application/octet-stream' },
      body: 'test-bytes',
    });
    if (!res.ok) throw new Error(`PUT ${key} failed: ${res.status}`);
  }

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

  it('deletes an orphan bucket key (no DB row); leaves a referenced key alone', async () => {
    const user = await registerUser('mixed');

    const orphanKey = `${TEST_PREFIX}/orphan/${uniqueSuffix()}`;
    const referencedKey = `${TEST_PREFIX}/referenced/${uniqueSuffix()}`;

    // Drop both keys directly into the bucket.
    await putBytes(orphanKey);
    await putBytes(referencedKey);

    // Create a MediaAsset row ONLY for the referenced key.
    await prisma.mediaAsset.create({
      data: {
        ownerId: user.userId,
        kind: 'image',
        status: 'ready',
        s3KeyRaw: referencedKey,
      },
    });

    // Sanity: both objects exist before sweep.
    expect(await storage.objectExists(orphanKey)).toBe(true);
    expect(await storage.objectExists(referencedKey)).toBe(true);

    const result = await sweepUc.execute();
    // Sweep saw at least our two seeded keys + maybe-leftovers
    // from prior tests; we only assert that orphan is gone and
    // referenced survives.
    expect(result.scanned).toBeGreaterThanOrEqual(2);
    expect(result.deleted).toBeGreaterThanOrEqual(1);

    expect(await storage.objectExists(orphanKey)).toBe(false);
    expect(await storage.objectExists(referencedKey)).toBe(true);
  });

  it('idempotent: a second sweep on the same state is a no-op for our keys', async () => {
    const user = await registerUser('idemp');
    const referencedKey = `${TEST_PREFIX}/idemp-ref/${uniqueSuffix()}`;
    await putBytes(referencedKey);
    await prisma.mediaAsset.create({
      data: {
        ownerId: user.userId,
        kind: 'image',
        status: 'ready',
        s3KeyRaw: referencedKey,
      },
    });

    await sweepUc.execute();
    // Run again — referenced row still in DB, key still in bucket;
    // our key must survive.
    await sweepUc.execute();
    expect(await storage.objectExists(referencedKey)).toBe(true);
  });
});
