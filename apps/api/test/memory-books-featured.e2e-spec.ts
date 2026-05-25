/**
 * Integration tests for `GET /memory-books/featured` ([IV.18.13.1]).
 *
 * Public discovery surface — lists currently-published memory
 * books across all users, most-recently-published first.
 *
 * Asserts:
 *   - `@Public()` — no bearer required, returns 200.
 *   - Excludes unpublished books.
 *   - Cross-user (returns books from multiple users).
 *   - Ordered by `publishedAt DESC`.
 *   - `?limit=` clamps the result count.
 *
 * Installed by prompt [IV.18.13.1].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail, uniqueSuffix } from './factories';

const TEST_PREFIX = 'memory-books-featured-e2e';

interface PublicBook {
  id: string;
  title: string;
  theme: string;
  publishedAt: string;
}

describe('GET /memory-books/featured (integration, requires Docker Postgres)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)', 'metrics'] });
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

  async function createAndPublishBook(token: string, title: string): Promise<string> {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/memory-books',
      headers: { authorization: `Bearer ${token}` },
      payload: { title },
    });
    expect(create.statusCode).toBe(201);
    const id = (JSON.parse(create.body) as { id: string }).id;
    const publish = await app.inject({
      method: 'POST',
      url: `/api/v1/memory-books/${id}/publish`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(publish.statusCode).toBe(200);
    return id;
  }

  async function fetchFeatured(query = ''): Promise<PublicBook[]> {
    const res = await app.inject({ method: 'GET', url: `/api/v1/memory-books/featured${query}` });
    expect(res.statusCode).toBe(200);
    return (JSON.parse(res.body) as { books: PublicBook[] }).books;
  }

  it('@Public(): no bearer + empty database → 200 with empty list', async () => {
    // Don't seed anything from this suite. Pre-existing rows from
    // other tests may exist; we only check the contract — list is
    // an array (possibly empty) and the route is reachable without
    // auth.
    const res = await app.inject({ method: 'GET', url: '/api/v1/memory-books/featured' });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray((JSON.parse(res.body) as { books: unknown[] }).books)).toBe(true);
  });

  it('excludes unpublished books', async () => {
    const u = await registerUser('unpub');
    // Create but DO NOT publish.
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/memory-books',
      headers: { authorization: `Bearer ${u.accessToken}` },
      payload: { title: `${TEST_PREFIX}-unpublished-${uniqueSuffix()}` },
    });
    expect(create.statusCode).toBe(201);
    const unpubId = (JSON.parse(create.body) as { id: string }).id;

    const list = await fetchFeatured();
    expect(list.some((b) => b.id === unpubId)).toBe(false);
  });

  it('lists published books across multiple users', async () => {
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');
    const aliceBookId = await createAndPublishBook(
      alice.accessToken,
      `${TEST_PREFIX}-alice-${uniqueSuffix()}`,
    );
    const bobBookId = await createAndPublishBook(
      bob.accessToken,
      `${TEST_PREFIX}-bob-${uniqueSuffix()}`,
    );

    const list = await fetchFeatured();
    expect(list.some((b) => b.id === aliceBookId)).toBe(true);
    expect(list.some((b) => b.id === bobBookId)).toBe(true);
  });

  it('orders by publishedAt DESC (newest first)', async () => {
    const u = await registerUser('ordered');
    const oldId = await createAndPublishBook(u.accessToken, `${TEST_PREFIX}-old-${uniqueSuffix()}`);
    // Slight wait to ensure publishedAt timestamps differ at ms granularity.
    await new Promise((r) => setTimeout(r, 50));
    const newId = await createAndPublishBook(u.accessToken, `${TEST_PREFIX}-new-${uniqueSuffix()}`);

    const list = await fetchFeatured();
    const oldIdx = list.findIndex((b) => b.id === oldId);
    const newIdx = list.findIndex((b) => b.id === newId);
    expect(oldIdx).toBeGreaterThanOrEqual(0);
    expect(newIdx).toBeGreaterThanOrEqual(0);
    // Newer book has a smaller index (closer to head of list).
    expect(newIdx).toBeLessThan(oldIdx);
  });

  it('?limit=1 clamps the result count', async () => {
    const u = await registerUser('limit');
    await createAndPublishBook(u.accessToken, `${TEST_PREFIX}-limit-1-${uniqueSuffix()}`);
    await createAndPublishBook(u.accessToken, `${TEST_PREFIX}-limit-2-${uniqueSuffix()}`);

    const list = await fetchFeatured('?limit=1');
    expect(list).toHaveLength(1);
  });
});
