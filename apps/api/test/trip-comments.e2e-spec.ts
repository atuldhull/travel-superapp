/**
 * Integration tests for trip comments (Phase 5, J4):
 *
 *   POST   /api/v1/trips/:tripId/comments
 *   GET    /api/v1/trips/:tripId/comments
 *   DELETE /api/v1/comments/:id
 *
 *   1. No bearer → 401.
 *   2. Comment on a never-published trip → 404 TRIP_NOT_COMMENTABLE.
 *   3. Comment on a published trip → 201; the thread GET returns it
 *      with the author's display name.
 *   4. A blocked commenter is rejected (403).
 *   5. The author can delete their own comment; a stranger gets 404;
 *      the trip owner can moderate (delete) someone else's comment.
 *
 * Installed by prompt [J4].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';

const TEST_PREFIX = 'comments-e2e';
const COORD = { lat: 35.0116, lng: 135.7681 };

interface CommentDto {
  id: string;
  tripId: string;
  authorId: string;
  authorDisplayName: string | null;
  body: string;
  createdAt: string;
}

describe('Trip comments (integration, requires Docker Postgres)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let dbReachable = true;

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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`comments test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (!dbReachable) return;
    await prisma.tripComment.deleteMany({ where: { body: { startsWith: TEST_PREFIX } } });
    await prisma.user.deleteMany({ where: { displayName: { startsWith: TEST_PREFIX } } });
  });

  afterAll(async () => {
    if (dbReachable) await app.close();
    await moduleRef.close();
  });

  async function registerUser(suffix: string): Promise<{ userId: string; accessToken: string }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `${TEST_PREFIX}-${suffix}-${Date.now()}-${Math.random()}@example.com`,
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
      payload: { title: `${TEST_PREFIX}-trip`, center: COORD, radiusKm: 5 },
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { id: string }).id;
  }

  async function publish(token: string, tripId: string): Promise<void> {
    await prisma.trip.update({
      where: { id: tripId },
      data: { endsOn: new Date(Date.now() - 7 * 86_400_000) },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/feed/trips/${tripId}/publish`,
      headers: { authorization: `Bearer ${token}` },
      payload: { visibility: 'PUBLIC' },
    });
    expect(res.statusCode).toBe(200);
  }

  function postComment(token: string, tripId: string, body: string) {
    return app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/comments`,
      headers: { authorization: `Bearer ${token}` },
      payload: { body },
    });
  }

  async function listComments(token: string, tripId: string): Promise<CommentDto[]> {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${tripId}/comments`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    return (JSON.parse(res.body) as { comments: CommentDto[] }).comments;
  }

  it('no bearer → 401', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips/whatever/comments',
      payload: { body: 'hi' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('comment on a never-published trip → 404 TRIP_NOT_COMMENTABLE', async () => {
    if (!dbReachable) return;
    const owner = await registerUser('owner1');
    const tripId = await createTrip(owner.accessToken);
    const res = await postComment(owner.accessToken, tripId, `${TEST_PREFIX} hello`);
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('TRIP_NOT_COMMENTABLE');
  });

  it('comment on a published trip → 201; thread GET returns it named', async () => {
    if (!dbReachable) return;
    const owner = await registerUser('owner2');
    const visitor = await registerUser('visitor');
    const tripId = await createTrip(owner.accessToken);
    await publish(owner.accessToken, tripId);

    const posted = await postComment(visitor.accessToken, tripId, `${TEST_PREFIX} lovely trip`);
    expect(posted.statusCode).toBe(201);

    const thread = await listComments(owner.accessToken, tripId);
    expect(thread).toHaveLength(1);
    expect(thread[0]!.body).toBe(`${TEST_PREFIX} lovely trip`);
    expect(thread[0]!.authorId).toBe(visitor.userId);
    expect(thread[0]!.authorDisplayName).toContain(TEST_PREFIX);
  });

  it('a blocked commenter is rejected (403)', async () => {
    if (!dbReachable) return;
    const owner = await registerUser('owner3');
    const hater = await registerUser('hater');
    const tripId = await createTrip(owner.accessToken);
    await publish(owner.accessToken, tripId);

    // Owner blocks the hater → the hater can't comment on their trip.
    const block = await app.inject({
      method: 'POST',
      url: `/api/v1/users/${hater.userId}/block`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(block.statusCode).toBe(200);

    const res = await postComment(hater.accessToken, tripId, `${TEST_PREFIX} let me in`);
    expect(res.statusCode).toBe(403);
  });

  it('author deletes own; stranger 404s; trip owner can moderate', async () => {
    if (!dbReachable) return;
    const owner = await registerUser('owner4');
    const commenter = await registerUser('commenter');
    const stranger = await registerUser('stranger');
    const tripId = await createTrip(owner.accessToken);
    await publish(owner.accessToken, tripId);

    // commenter posts two comments
    const c1 = JSON.parse(
      (await postComment(commenter.accessToken, tripId, `${TEST_PREFIX} one`)).body,
    ) as CommentDto;
    const c2 = JSON.parse(
      (await postComment(commenter.accessToken, tripId, `${TEST_PREFIX} two`)).body,
    ) as CommentDto;

    // a stranger cannot delete it → 404 (existence-probe defence)
    const strangerTry = await app.inject({
      method: 'DELETE',
      url: `/api/v1/comments/${c1.id}`,
      headers: { authorization: `Bearer ${stranger.accessToken}` },
    });
    expect(strangerTry.statusCode).toBe(404);

    // the author deletes their own → 200
    const authorDel = await app.inject({
      method: 'DELETE',
      url: `/api/v1/comments/${c1.id}`,
      headers: { authorization: `Bearer ${commenter.accessToken}` },
    });
    expect(authorDel.statusCode).toBe(200);

    // the trip owner moderates the second one → 200
    const ownerDel = await app.inject({
      method: 'DELETE',
      url: `/api/v1/comments/${c2.id}`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(ownerDel.statusCode).toBe(200);

    expect(await listComments(owner.accessToken, tripId)).toHaveLength(0);
  });
});
