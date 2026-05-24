/**
 * Integration tests for `GET /account/export.ndjson` ([IV.18.16.4]).
 *
 * Asserts:
 *   1. Content-Type is `application/x-ndjson`.
 *   2. Each line parses as a `{ type, data }` envelope.
 *   3. The first line is a `metadata` envelope with the caller's id.
 *   4. The second line is a `user` envelope.
 *   5. 401 without bearer.
 *
 * The fixture only registers a user and immediately exports — no
 * trip / media seeding required, since the test focuses on wire
 * format not row coverage (row coverage is exhaustive in
 * `account-export.e2e-spec.ts`).
 *
 * Installed by prompt [IV.18.16.4].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'account-export-streaming-e2e';

interface Envelope {
  type: string;
  data: Record<string, unknown>;
}

describe('GET /account/export.ndjson (integration, requires Docker Postgres)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let dbReachable = true;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)', 'metrics'] });
    await app.register(fastifyCookie);
    try {
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
      prisma = moduleRef.get(PrismaService);
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`account-export-streaming test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
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
        email: uniqueEmail(`${TEST_PREFIX}-${suffix}`),
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-${suffix}`,
      },
    });
    expect(res.statusCode).toBe(201);
    return JSON.parse(res.body) as { userId: string; accessToken: string };
  }

  function parseLines(body: string): Envelope[] {
    return body
      .split('\n')
      .filter((l) => l.length > 0)
      .map((l) => JSON.parse(l) as Envelope);
  }

  it('without bearer → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/account/export.ndjson' });
    expect(res.statusCode).toBe(401);
  });

  it('returns application/x-ndjson with valid line-by-line envelopes', async () => {
    const u = await registerUser('happy');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/account/export.ndjson',
      headers: { authorization: `Bearer ${u.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/x-ndjson');

    const envelopes = parseLines(res.body);
    expect(envelopes.length).toBeGreaterThanOrEqual(2);
    for (const env of envelopes) {
      expect(typeof env.type).toBe('string');
      expect(typeof env.data).toBe('object');
    }
  });

  it('first line is metadata with caller userId; second line is user', async () => {
    const u = await registerUser('order');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/account/export.ndjson',
      headers: { authorization: `Bearer ${u.accessToken}` },
    });
    const envelopes = parseLines(res.body);
    expect(envelopes[0]?.type).toBe('metadata');
    expect(envelopes[0]?.data['userId']).toBe(u.userId);
    expect(envelopes[0]?.data['formatVersion']).toBe(1);
    expect(envelopes[1]?.type).toBe('user');
    expect(envelopes[1]?.data['id']).toBe(u.userId);
  });

  it('every line is a complete JSON object terminated by \\n (no array wrap, no trailing comma)', async () => {
    const u = await registerUser('format');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/account/export.ndjson',
      headers: { authorization: `Bearer ${u.accessToken}` },
    });
    // No leading `[`, no trailing `]` — pure NDJSON.
    expect(res.body.startsWith('[')).toBe(false);
    expect(res.body.trimEnd().endsWith(']')).toBe(false);
    // Last char before final newline isn't a comma.
    const trimmed = res.body.trimEnd();
    expect(trimmed[trimmed.length - 1]).toBe('}');
  });
});
