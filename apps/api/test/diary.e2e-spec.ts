/**
 * Integration tests for the Adventure Diary module.
 *
 * Deterministic: the heuristic AI assistant + pure gamification rules
 * make every assertion exact. Each test registers its own user so
 * gamification state never bleeds between cases.
 *
 * Installed for the adventure-diary feature.
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'diary-e2e';

describe('Adventure Diary (integration, requires Docker Postgres + Redis)', () => {
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

  async function token(suffix: string): Promise<string> {
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
    return (JSON.parse(res.body) as { accessToken: string }).accessToken;
  }

  it('without a bearer → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/diary/entries',
      payload: { title: 'x', body: 'y' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('first entry → 55 pts, streak 1, First Steps badge', async () => {
    const tok = await token('first');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/diary/entries',
      headers: { authorization: `Bearer ${tok}` },
      payload: { title: 'Day 1', body: 'A short note about the road.' },
    });
    expect(res.statusCode).toBe(201);
    const b = JSON.parse(res.body) as {
      entry: { id: string; title: string };
      gamification: {
        pointsAwarded: number;
        totalPoints: number;
        currentStreak: number;
        newlyEarnedBadges: string[];
      };
    };
    expect(b.entry.title).toBe('Day 1');
    expect(b.gamification.pointsAwarded).toBe(55); // 50 base + 1×5 streak
    expect(b.gamification.totalPoints).toBe(55);
    expect(b.gamification.currentStreak).toBe(1);
    expect(b.gamification.newlyEarnedBadges).toContain('first_steps');
  });

  it('substantial + AI + trip-linked entry scores the full bonus', async () => {
    const tok = await token('full');
    const longBody = 'x'.repeat(300);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/diary/entries',
      headers: { authorization: `Bearer ${tok}` },
      payload: { title: 'Big day', body: longBody, aiAssisted: true, tripId: 'trip_abc' },
    });
    expect(res.statusCode).toBe(201);
    const b = JSON.parse(res.body) as { gamification: { pointsAwarded: number } };
    // 50 base + 20 substantial + 15 ai + 10 trip + 5 streak = 100
    expect(b.gamification.pointsAwarded).toBe(100);
  });

  it('lists entries newest-first + gamification view exposes the shelf', async () => {
    const tok = await token('list');
    await app.inject({
      method: 'POST',
      url: '/api/v1/diary/entries',
      headers: { authorization: `Bearer ${tok}` },
      payload: { title: 'Entry A', body: 'first' },
    });
    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/diary/entries',
      headers: { authorization: `Bearer ${tok}` },
    });
    expect(list.statusCode).toBe(200);
    const entries = (JSON.parse(list.body) as { entries: unknown[] }).entries;
    expect(entries.length).toBe(1);

    const g = await app.inject({
      method: 'GET',
      url: '/api/v1/diary/gamification',
      headers: { authorization: `Bearer ${tok}` },
    });
    expect(g.statusCode).toBe(200);
    const view = JSON.parse(g.body) as {
      totalPoints: number;
      badges: { key: string; earned: boolean }[];
    };
    expect(view.totalPoints).toBe(55);
    expect(view.badges.length).toBeGreaterThanOrEqual(8);
    expect(view.badges.find((x) => x.key === 'first_steps')?.earned).toBe(true);
    expect(view.badges.find((x) => x.key === 'odyssey')?.earned).toBe(false);
  });

  it('AI assist: polish cleans prose, prompt yields 3 suggestions', async () => {
    const tok = await token('assist');
    const polish = await app.inject({
      method: 'POST',
      url: '/api/v1/diary/assist',
      headers: { authorization: `Bearer ${tok}` },
      payload: { mode: 'polish', text: 'we hiked all day   i was tired but happy' },
    });
    expect(polish.statusCode).toBe(200);
    const pb = JSON.parse(polish.body) as { text: string; aiBacked: boolean };
    expect(pb.aiBacked).toBe(false);
    expect(pb.text).toMatch(/^We hiked all day/);
    expect(pb.text).toContain(' I '); // lone "i" fixed
    expect(pb.text.trim().endsWith('.')).toBe(true);

    const prompt = await app.inject({
      method: 'POST',
      url: '/api/v1/diary/assist',
      headers: { authorization: `Bearer ${tok}` },
      payload: { mode: 'prompt', place: 'Spiti', mood: 'adventurous' },
    });
    expect(prompt.statusCode).toBe(200);
    const sb = JSON.parse(prompt.body) as { suggestions: string[] };
    expect(sb.suggestions).toHaveLength(3);
    expect(sb.suggestions.join(' ')).toContain('Spiti');
  });

  it('polish without text → 422 DIARY_ASSIST_NEEDS_TEXT', async () => {
    const tok = await token('notext');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/diary/assist',
      headers: { authorization: `Bearer ${tok}` },
      payload: { mode: 'polish' },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('DIARY_ASSIST_NEEDS_TEXT');
  });

  it('empty title → 422 validation', async () => {
    const tok = await token('badtitle');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/diary/entries',
      headers: { authorization: `Bearer ${tok}` },
      payload: { title: '', body: 'something' },
    });
    expect(res.statusCode).toBe(422);
  });
});
