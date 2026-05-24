/**
 * Integration tests for the admin-promote CLI ([IV.18.3.2]).
 *
 * Exercises the exported core (`promoteUserToAdmin`) + the `runCli`
 * wrapper against the real Docker Postgres — the same user row the
 * Identity register path creates. No subprocess spawn: the test
 * imports the script and passes in its own PrismaService so DB
 * teardown is clean.
 *
 * Covers:
 *   - register → CLI runs with the right email → role flips to 'admin'
 *   - second run on same user → `ALREADY_ADMIN` (idempotent)
 *   - bogus email → `USER_NOT_FOUND` + exit 1
 *   - missing positional arg → `USAGE_ERROR` + exit 1
 *   - malformed email arg → `USAGE_ERROR` + exit 1
 *
 * Installed by prompt [IV.18.3.2].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { promoteUserToAdmin, runCli } from '../scripts/promote-admin';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'promote-e2e';

describe('promote-admin CLI (integration, requires Docker Postgres)', () => {
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
      console.warn(`promote-admin test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
  });

  afterAll(async () => {
    if (dbReachable) {
      await app.close();
    }
    await moduleRef.close();
  });

  async function registerUser(suffix: string): Promise<{
    userId: string;
    email: string;
  }> {
    const email = uniqueEmail(`${TEST_PREFIX}-${suffix}`);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-${suffix}`,
      },
    });
    expect(res.statusCode).toBe(201);
    const { userId } = JSON.parse(res.body) as { userId: string };
    return { userId, email };
  }

  it('promoteUserToAdmin flips role from user → admin and writes the row', async () => {
    const { userId, email } = await registerUser('core-ok');

    const result = await promoteUserToAdmin(prisma, email);
    expect(result).toEqual({
      kind: 'PROMOTED',
      userId,
      email: email.toLowerCase(),
      previousRole: 'user',
    });

    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    expect(row?.role).toBe('admin');
  });

  it('second call on an admin user returns ALREADY_ADMIN without touching the row', async () => {
    const { userId, email } = await registerUser('idempotent');
    await promoteUserToAdmin(prisma, email);

    const before = await prisma.user.findUnique({
      where: { id: userId },
      select: { updatedAt: true },
    });
    // Tiny pause so a silent update would move updatedAt measurably.
    await new Promise((r) => setTimeout(r, 25));
    const result = await promoteUserToAdmin(prisma, email);
    expect(result.kind).toBe('ALREADY_ADMIN');
    const after = await prisma.user.findUnique({
      where: { id: userId },
      select: { updatedAt: true },
    });
    expect(after?.updatedAt.getTime()).toBe(before?.updatedAt.getTime());
  });

  it('USER_NOT_FOUND when no matching emailHash exists', async () => {
    const result = await promoteUserToAdmin(prisma, uniqueEmail('nobody'));
    expect(result.kind).toBe('USER_NOT_FOUND');
  });

  it('runCli happy path: exit 0 + PROMOTED', async () => {
    const { userId, email } = await registerUser('cli-ok');
    const { exitCode, result } = await runCli([email], { prisma });
    expect(exitCode).toBe(0);
    expect(result.kind).toBe('PROMOTED');
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    expect(row?.role).toBe('admin');
  });

  it('runCli with unknown email: exit 1 + USER_NOT_FOUND', async () => {
    const { exitCode, result } = await runCli([uniqueEmail('ghost')], { prisma });
    expect(exitCode).toBe(1);
    expect(result.kind).toBe('USER_NOT_FOUND');
  });

  it('runCli with zero args: exit 1 + USAGE_ERROR', async () => {
    const { exitCode, result } = await runCli([], { prisma });
    expect(exitCode).toBe(1);
    expect(result.kind).toBe('USAGE_ERROR');
  });

  it('runCli with a malformed email: exit 1 + USAGE_ERROR', async () => {
    const { exitCode, result } = await runCli(['not-an-email'], { prisma });
    expect(exitCode).toBe(1);
    expect(result.kind).toBe('USAGE_ERROR');
  });
});
