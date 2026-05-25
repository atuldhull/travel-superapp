/**
 * Integration tests for the follower / following list endpoints
 * (Phase 5, J2):
 *
 *   GET /api/v1/users/:id/followers
 *   GET /api/v1/users/:id/following
 *
 *   1. No bearer → 401.
 *   2. Followers list reflects who followed the target.
 *   3. Following list reflects who the target follows.
 *   4. Block filter — a user blocked-with the viewer is omitted.
 *   5. Unknown user → 200 { users: [] }.
 *
 * Installed by prompt [J2].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueSuffix } from './factories';

const TEST_PREFIX = 'connections-e2e';

interface ConnUser {
  userId: string;
  displayName: string;
  followedAt: string;
}

describe('GET /users/:id/(followers|following) (integration, requires Docker Postgres)', () => {
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
    await prisma.user.deleteMany({ where: { displayName: { startsWith: TEST_PREFIX } } });
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
        email: `${TEST_PREFIX}-${suffix}-${uniqueSuffix()}@example.com`,
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-${suffix}`,
      },
    });
    expect(res.statusCode).toBe(201);
    return JSON.parse(res.body) as { userId: string; accessToken: string };
  }

  async function follow(token: string, targetId: string): Promise<void> {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/users/${targetId}/follow`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  }

  async function block(token: string, targetId: string): Promise<void> {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/users/${targetId}/block`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  }

  async function list(
    token: string,
    targetId: string,
    kind: 'followers' | 'following',
  ): Promise<ConnUser[]> {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${targetId}/${kind}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    return (JSON.parse(res.body) as { users: ConnUser[] }).users;
  }

  it('no bearer → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/users/whoever/followers' });
    expect(res.statusCode).toBe(401);
  });

  it('followers list reflects who followed the target', async () => {
    const star = await registerUser('star');
    const fan1 = await registerUser('fan1');
    const fan2 = await registerUser('fan2');
    await follow(fan1.accessToken, star.userId);
    await follow(fan2.accessToken, star.userId);

    const followers = await list(star.accessToken, star.userId, 'followers');
    const ids = followers.map((u) => u.userId).sort();
    expect(ids).toEqual([fan1.userId, fan2.userId].sort());
    // Each row carries a display name + a followedAt timestamp.
    expect(
      followers.every((u) => typeof u.displayName === 'string' && u.displayName.length > 0),
    ).toBe(true);
  });

  it('following list reflects who the target follows', async () => {
    const explorer = await registerUser('explorer');
    const a = await registerUser('idol-a');
    const b = await registerUser('idol-b');
    await follow(explorer.accessToken, a.userId);
    await follow(explorer.accessToken, b.userId);

    const following = await list(explorer.accessToken, explorer.userId, 'following');
    expect(following.map((u) => u.userId).sort()).toEqual([a.userId, b.userId].sort());
  });

  it('block filter — a user blocked-with the viewer is omitted', async () => {
    const star = await registerUser('star2');
    const fan = await registerUser('fan-ok');
    const troll = await registerUser('troll');
    await follow(fan.accessToken, star.userId);
    await follow(troll.accessToken, star.userId);

    // The viewer (star) blocks the troll → troll drops from the list.
    await block(star.accessToken, troll.userId);
    const followers = await list(star.accessToken, star.userId, 'followers');
    const ids = followers.map((u) => u.userId);
    expect(ids).toContain(fan.userId);
    expect(ids).not.toContain(troll.userId);
  });

  it('unknown user → 200 { users: [] }', async () => {
    const viewer = await registerUser('viewer');
    const followers = await list(viewer.accessToken, 'nonexistent-user-id', 'followers');
    expect(followers).toEqual([]);
  });
});
