/**
 * Integration tests for MemoryBook v1 + the Media ↔ book attach
 * surface ([IV.18.12.6]).
 *
 *   POST   /memory-books                    create
 *   GET    /memory-books                    list mine
 *   GET    /memory-books/:id                get one + attached asset ids
 *   PATCH  /memory-books/:id                update metadata
 *   DELETE /memory-books/:id                delete (MediaAsset.memoryBookId → null)
 *   PATCH  /media/:id/memory-book           attach/detach
 *
 * Uses real Postgres + MinIO (media upload → confirm dance from
 * [IV.18.12.1] to produce `ready` assets to attach).
 *
 * Installed by prompt [IV.18.12.6].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';

const TEST_PREFIX = 'mem-book-e2e';

interface BookResp {
  readonly id: string;
  readonly ownerId: string;
  readonly title: string;
  readonly theme: string;
  readonly coverS3Key: string | null;
  readonly publishedAt: string | null;
}

describe('Memory Book v1 (integration, requires Postgres + MinIO)', () => {
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
      console.warn(`memory-book test: infra not reachable (${message}). Skipping.`);
      infraReachable = false;
    }
  });

  afterEach(async () => {
    if (!infraReachable) return;
    // User cascade-deletes MediaAsset + MemoryBook rows.
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

  it('POST /memory-books without a bearer → 401', async () => {
    if (!infraReachable) return;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/memory-books',
      payload: { title: 'X' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('happy path: create → list → get → update → delete', async () => {
    if (!infraReachable) return;
    const { accessToken } = await registerUser('happy');

    // Create
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/memory-books',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { title: `${TEST_PREFIX}-paris`, theme: 'vintage' },
    });
    expect(create.statusCode).toBe(201);
    const book = JSON.parse(create.body) as BookResp;
    expect(book.title).toBe(`${TEST_PREFIX}-paris`);
    expect(book.theme).toBe('vintage');
    expect(book.publishedAt).toBeNull();

    // List — includes our book.
    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/memory-books',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const listBody = JSON.parse(list.body) as { books: BookResp[] };
    expect(listBody.books.find((b) => b.id === book.id)).toBeDefined();

    // Get one — assetIds empty (nothing attached).
    const get = await app.inject({
      method: 'GET',
      url: `/api/v1/memory-books/${book.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(get.statusCode).toBe(200);
    const { book: got, assetIds } = JSON.parse(get.body) as {
      book: BookResp;
      assetIds: string[];
    };
    expect(got.id).toBe(book.id);
    expect(assetIds).toEqual([]);

    // Update title.
    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/memory-books/${book.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { title: `${TEST_PREFIX}-paris-renamed` },
    });
    expect(patch.statusCode).toBe(200);
    expect(JSON.parse(patch.body).title).toBe(`${TEST_PREFIX}-paris-renamed`);
    expect(JSON.parse(patch.body).theme).toBe('vintage'); // unchanged

    // Delete.
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/memory-books/${book.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(del.statusCode).toBe(204);

    // Get after delete → 404.
    const gone = await app.inject({
      method: 'GET',
      url: `/api/v1/memory-books/${book.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(gone.statusCode).toBe(404);
    expect(JSON.parse(gone.body).code).toBe('MEMORY_BOOK_NOT_FOUND');
  });

  it('default theme is "classic" when omitted', async () => {
    if (!infraReachable) return;
    const { accessToken } = await registerUser('default-theme');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/memory-books',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { title: `${TEST_PREFIX}-default` },
    });
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body).theme).toBe('classic');
  });

  it('attach media → GET assetIds includes it; detach → removed', async () => {
    if (!infraReachable) return;
    const { accessToken } = await registerUser('attach');
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/memory-books',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { title: `${TEST_PREFIX}-attach` },
    });
    const bookId = (JSON.parse(create.body) as BookResp).id;
    const mediaId = await uploadReadyMedia(accessToken);

    const attach = await app.inject({
      method: 'PATCH',
      url: `/api/v1/media/${mediaId}/memory-book`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { memoryBookId: bookId },
    });
    expect(attach.statusCode).toBe(200);

    const get = await app.inject({
      method: 'GET',
      url: `/api/v1/memory-books/${bookId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const body = JSON.parse(get.body) as { assetIds: string[] };
    expect(body.assetIds).toContain(mediaId);

    // Detach.
    const detach = await app.inject({
      method: 'PATCH',
      url: `/api/v1/media/${mediaId}/memory-book`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { memoryBookId: null },
    });
    expect(detach.statusCode).toBe(200);

    const after = await app.inject({
      method: 'GET',
      url: `/api/v1/memory-books/${bookId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect((JSON.parse(after.body) as { assetIds: string[] }).assetIds).toEqual([]);
  });

  it('attaching to someone else’s book → 404 MEMORY_BOOK_NOT_FOUND', async () => {
    if (!infraReachable) return;
    const alice = await registerUser('a-idor');
    const bob = await registerUser('b-idor');
    const aliceBook = await app.inject({
      method: 'POST',
      url: '/api/v1/memory-books',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { title: `${TEST_PREFIX}-alice` },
    });
    const aliceBookId = (JSON.parse(aliceBook.body) as BookResp).id;
    const bobMediaId = await uploadReadyMedia(bob.accessToken);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/media/${bobMediaId}/memory-book`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: { memoryBookId: aliceBookId },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('MEMORY_BOOK_NOT_FOUND');
  });

  it('attaching someone else’s media to my book → 404 MEDIA_NOT_FOUND', async () => {
    if (!infraReachable) return;
    const alice = await registerUser('a-med');
    const bob = await registerUser('b-med');
    const aliceMediaId = await uploadReadyMedia(alice.accessToken);
    const bobBook = await app.inject({
      method: 'POST',
      url: '/api/v1/memory-books',
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: { title: `${TEST_PREFIX}-bob` },
    });
    const bobBookId = (JSON.parse(bobBook.body) as BookResp).id;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/media/${aliceMediaId}/memory-book`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: { memoryBookId: bobBookId },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('MEDIA_NOT_FOUND');
  });

  it('GET on another user’s book → 404 MEMORY_BOOK_NOT_FOUND', async () => {
    if (!infraReachable) return;
    const alice = await registerUser('a-get');
    const bob = await registerUser('b-get');
    const aliceBook = await app.inject({
      method: 'POST',
      url: '/api/v1/memory-books',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { title: `${TEST_PREFIX}-a` },
    });
    const aliceBookId = (JSON.parse(aliceBook.body) as BookResp).id;

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/memory-books/${aliceBookId}`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('MEMORY_BOOK_NOT_FOUND');
  });

  it('deleting a book with attached media: media survives, memoryBookId NULLs', async () => {
    if (!infraReachable) return;
    const { accessToken } = await registerUser('cascade');
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/memory-books',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { title: `${TEST_PREFIX}-cascade` },
    });
    const bookId = (JSON.parse(create.body) as BookResp).id;
    const mediaId = await uploadReadyMedia(accessToken);
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/media/${mediaId}/memory-book`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { memoryBookId: bookId },
    });

    // Delete book.
    await app.inject({
      method: 'DELETE',
      url: `/api/v1/memory-books/${bookId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    // Media row still exists (verify via the download-url endpoint,
    // which owner-gates by MediaAsset lookup).
    const dl = await app.inject({
      method: 'GET',
      url: `/api/v1/media/${mediaId}/download-url`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(dl.statusCode).toBe(200);
  });

  it('empty title → 422 VALIDATION_FAILED (Zod min(1))', async () => {
    if (!infraReachable) return;
    const { accessToken } = await registerUser('empty');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/memory-books',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { title: '' },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });

  it('list returns only my own books', async () => {
    if (!infraReachable) return;
    const alice = await registerUser('l-a');
    const bob = await registerUser('l-b');
    await app.inject({
      method: 'POST',
      url: '/api/v1/memory-books',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { title: `${TEST_PREFIX}-ab` },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/memory-books',
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: { title: `${TEST_PREFIX}-bb` },
    });

    const aliceList = await app.inject({
      method: 'GET',
      url: '/api/v1/memory-books',
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    const body = JSON.parse(aliceList.body) as { books: BookResp[] };
    const mine = body.books.filter((b) => b.title.startsWith(TEST_PREFIX));
    expect(mine).toHaveLength(1);
    expect(mine[0]!.ownerId).toBe(alice.userId);
  });
});
