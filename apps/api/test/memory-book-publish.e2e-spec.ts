/**
 * Integration tests for the Memory Book publish flow
 * ([IV.18.12.7]).
 *
 *   POST   /memory-books/:id/publish                                — owner
 *   POST   /memory-books/:id/unpublish                              — owner
 *   GET    /memory-books/public/:id                                 — public, no auth
 *   GET    /memory-books/public/:id/assets/:assetId/download-url    — public, no auth
 *
 * The bookId itself is the unguessable public token (cuid =
 * ~130 bits of entropy). Unpublished books 404 on the public
 * read; an attacker probing the id space learns nothing about
 * private books.
 *
 * Verifies the end-to-end share-with-the-world flow including
 * unauthenticated bytes-out-of-MinIO via the presigned URL.
 *
 * Installed by prompt [IV.18.12.7].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'mem-book-publish-e2e';

interface BookResp {
  readonly id: string;
  readonly publishedAt: string | null;
}

describe('Memory Book publish flow (integration, requires Postgres + MinIO)', () => {
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
    const probe = await fetch(`${process.env['S3_ENDPOINT']}/`);
    if (probe.status >= 500) throw new Error(`MinIO probe ${probe.status}`);
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

  async function createBookWithMedia(token: string): Promise<{
    bookId: string;
    mediaId: string;
    bytes: Buffer;
  }> {
    // Upload + confirm a real media asset.
    const contentType = 'image/png';
    const urlRes = await app.inject({
      method: 'POST',
      url: '/api/v1/media/upload-url',
      headers: { authorization: `Bearer ${token}` },
      payload: { kind: 'image', contentType },
    });
    const { mediaAssetId, uploadUrl } = JSON.parse(urlRes.body) as {
      mediaAssetId: string;
      uploadUrl: string;
    };
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    await fetch(uploadUrl, {
      method: 'PUT',
      body: bytes,
      headers: { 'content-type': contentType },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/media/${mediaAssetId}/confirm`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    // Create book + attach media.
    const bookRes = await app.inject({
      method: 'POST',
      url: '/api/v1/memory-books',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: `${TEST_PREFIX}-album` },
    });
    const bookId = (JSON.parse(bookRes.body) as { id: string }).id;
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/media/${mediaAssetId}/memory-book`,
      headers: { authorization: `Bearer ${token}` },
      payload: { memoryBookId: bookId },
    });

    return { bookId, mediaId: mediaAssetId, bytes };
  }

  it('GET /memory-books/public/:id on an unpublished book → 404 (no auth needed)', async () => {
    const { accessToken } = await registerUser('unpub-pub');
    const { bookId } = await createBookWithMedia(accessToken);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/memory-books/public/${bookId}`,
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('MEMORY_BOOK_NOT_FOUND');
  });

  it('happy path: publish → public GET succeeds → public download URL fetches bytes', async () => {
    const { accessToken } = await registerUser('happy');
    const { bookId, mediaId, bytes } = await createBookWithMedia(accessToken);

    // Publish.
    const pub = await app.inject({
      method: 'POST',
      url: `/api/v1/memory-books/${bookId}/publish`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(pub.statusCode).toBe(200);
    const pubBody = JSON.parse(pub.body) as BookResp;
    expect(pubBody.publishedAt).not.toBeNull();

    // Public GET — no auth.
    const pubGet = await app.inject({
      method: 'GET',
      url: `/api/v1/memory-books/public/${bookId}`,
    });
    expect(pubGet.statusCode).toBe(200);
    const body = JSON.parse(pubGet.body) as {
      book: { id: string; publishedAt: string };
      assetIds: string[];
    };
    expect(body.book.id).toBe(bookId);
    expect(body.assetIds).toContain(mediaId);

    // Public asset download URL — no auth.
    const dlRes = await app.inject({
      method: 'GET',
      url: `/api/v1/memory-books/public/${bookId}/assets/${mediaId}/download-url`,
    });
    expect(dlRes.statusCode).toBe(200);
    const { url } = JSON.parse(dlRes.body) as { url: string; expiresAt: string };

    // Fetch the URL and verify bytes match.
    const fileRes = await fetch(url);
    expect(fileRes.status).toBe(200);
    const got = Buffer.from(await fileRes.arrayBuffer());
    expect(got.equals(bytes)).toBe(true);
  });

  it('unpublish → public GET 404s; existing presigned URLs still work for their TTL', async () => {
    const { accessToken } = await registerUser('unpub-flow');
    const { bookId, mediaId } = await createBookWithMedia(accessToken);
    await app.inject({
      method: 'POST',
      url: `/api/v1/memory-books/${bookId}/publish`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    // Mint a presigned URL while published.
    const dl = await app.inject({
      method: 'GET',
      url: `/api/v1/memory-books/public/${bookId}/assets/${mediaId}/download-url`,
    });
    expect(dl.statusCode).toBe(200);
    const { url } = JSON.parse(dl.body) as { url: string };

    // Unpublish.
    const unpub = await app.inject({
      method: 'POST',
      url: `/api/v1/memory-books/${bookId}/unpublish`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(unpub.statusCode).toBe(200);
    expect(JSON.parse(unpub.body).publishedAt).toBeNull();

    // Public GET now 404s.
    const gone = await app.inject({
      method: 'GET',
      url: `/api/v1/memory-books/public/${bookId}`,
    });
    expect(gone.statusCode).toBe(404);

    // Asking for a NEW download URL also 404s.
    const newDl = await app.inject({
      method: 'GET',
      url: `/api/v1/memory-books/public/${bookId}/assets/${mediaId}/download-url`,
    });
    expect(newDl.statusCode).toBe(404);
    expect(JSON.parse(newDl.body).code).toBe('MEDIA_NOT_FOUND');

    // The previously-issued presigned URL still works (S3 contract).
    const stillFetchable = await fetch(url);
    expect(stillFetchable.status).toBe(200);
  });

  it('publish on someone else’s book → 404', async () => {
    const alice = await registerUser('pub-a');
    const bob = await registerUser('pub-b');
    const { bookId } = await createBookWithMedia(alice.accessToken);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/memory-books/${bookId}/publish`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('MEMORY_BOOK_NOT_FOUND');
  });

  it('public asset URL: assetId not attached to this book → 404', async () => {
    const { accessToken } = await registerUser('wrong-asset');
    const { bookId } = await createBookWithMedia(accessToken);
    await app.inject({
      method: 'POST',
      url: `/api/v1/memory-books/${bookId}/publish`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/memory-books/public/${bookId}/assets/some-other-asset/download-url`,
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('MEDIA_NOT_FOUND');
  });

  it('public GET returns minimal owner-safe metadata (no ownerId leak)', async () => {
    const { accessToken } = await registerUser('priv');
    const { bookId } = await createBookWithMedia(accessToken);
    await app.inject({
      method: 'POST',
      url: `/api/v1/memory-books/${bookId}/publish`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/memory-books/public/${bookId}`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { book: Record<string, unknown> };
    // The public DTO MUST NOT include ownerId — strangers shouldn't
    // be able to enumerate the publisher's user id.
    expect(body.book).not.toHaveProperty('ownerId');
    expect(body.book).toHaveProperty('id');
    expect(body.book).toHaveProperty('title');
    expect(body.book).toHaveProperty('publishedAt');
  });

  it('publishing twice refreshes the timestamp (idempotent in effect)', async () => {
    const { accessToken } = await registerUser('republish');
    const { bookId } = await createBookWithMedia(accessToken);

    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/memory-books/${bookId}/publish`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const firstPublishedAt = (JSON.parse(first.body) as BookResp).publishedAt!;
    // Wait a moment so the timestamps actually differ.
    await new Promise((r) => setTimeout(r, 50));
    const second = await app.inject({
      method: 'POST',
      url: `/api/v1/memory-books/${bookId}/publish`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const secondPublishedAt = (JSON.parse(second.body) as BookResp).publishedAt!;

    expect(new Date(secondPublishedAt).getTime()).toBeGreaterThan(
      new Date(firstPublishedAt).getTime(),
    );
  });
});
