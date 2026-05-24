/**
 * Integration tests for the composite safety score ([IV.18.11.4]).
 *
 *   POST /api/v1/safety/score → { score 0..100, grade A..F, breakdown }
 *
 * Seeds real CrimeIncident + ScamReport rows via GeoQueries + the
 * existing POST /safety/scam-reports flow, then asserts the score
 * responds correctly to the severity-weighted formula:
 *
 *   penalty = Σ crime_rank × 10 + Σ scam_rank × 5
 *   score = max(0, 100 - penalty)
 *
 * SOS events deliberately excluded — verified by seeding an SOS
 * at the query coord and asserting the score is unchanged.
 *
 * Installed by prompt [IV.18.11.4].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { GeoQueries } from '../src/common/db/geo-queries';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail, uniqueSuffix } from './factories';

const SOURCE_PREFIX = 'safety-score-e2e';
// Empty slab of the South Atlantic — no other Safety suite seeds here.
const ANCHOR = { lat: -41.2345, lng: -31.6789 };

interface ScoreResp {
  readonly score: number;
  readonly grade: string;
  readonly radiusKm: number;
  readonly breakdown: {
    readonly crimes: number;
    readonly scams: number;
    readonly byCrimeSeverity: Readonly<Record<string, number>>;
    readonly byScamSeverity: Readonly<Record<string, number>>;
  };
}

describe('Safety score (integration, requires Postgres)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let geo: GeoQueries;
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
      geo = moduleRef.get(GeoQueries);
      await prisma.$queryRaw`SELECT 1`;
      await prisma.crimeIncident.deleteMany({
        where: { source: { startsWith: SOURCE_PREFIX } },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`safety-score test: infra not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (!dbReachable) return;
    await prisma.crimeIncident.deleteMany({
      where: { source: { startsWith: SOURCE_PREFIX } },
    });
    // User cascade-deletes ScamReport + SosEvent rows.
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: SOURCE_PREFIX } },
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
        email: uniqueEmail(`${SOURCE_PREFIX}-${suffix}`),
        password: 'correct-horse-battery-staple',
        displayName: `${SOURCE_PREFIX}-${suffix}`,
      },
    });
    expect(res.statusCode).toBe(201);
    return JSON.parse(res.body) as { userId: string; accessToken: string };
  }

  async function seedCrime(opts: {
    category?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    latOffset?: number;
    lngOffset?: number;
  }): Promise<void> {
    await geo.insertCrimeIncident({
      source: `${SOURCE_PREFIX}-${opts.severity}-${uniqueSuffix()}`,
      category: opts.category ?? 'theft',
      severity: opts.severity,
      lat: ANCHOR.lat + (opts.latOffset ?? 0.001),
      lng: ANCHOR.lng + (opts.lngOffset ?? 0.001),
      reportedAt: new Date(),
    });
  }

  async function seedScam(
    accessToken: string,
    opts: { severity: 'low' | 'medium' | 'high' | 'critical' },
  ): Promise<void> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/scam-reports',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        center: { lat: ANCHOR.lat + 0.001, lng: ANCHOR.lng + 0.001 },
        category: 'pickpocket',
        severity: opts.severity,
        description: 'Test scam report for safety-score test suite.',
      },
    });
    expect(res.statusCode).toBe(201);
  }

  async function getScore(accessToken: string, body: Record<string, unknown>): Promise<ScoreResp> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/score',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    return JSON.parse(res.body) as ScoreResp;
  }

  it('POST /safety/score without a bearer → 401', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/score',
      payload: { center: ANCHOR },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('empty area → score 100, grade A, empty breakdown', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('clean');
    const r = await getScore(accessToken, { center: ANCHOR });
    expect(r.score).toBe(100);
    expect(r.grade).toBe('A');
    expect(r.radiusKm).toBe(2);
    expect(r.breakdown.crimes).toBe(0);
    expect(r.breakdown.scams).toBe(0);
  });

  it('one medium crime → score drops by exactly 20 (2 × 10)', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('onecrime');
    await seedCrime({ severity: 'medium' });
    const r = await getScore(accessToken, { center: ANCHOR });
    // medium rank = 2; CRIME_MULTIPLIER = 10 → penalty 20.
    expect(r.score).toBe(80);
    expect(r.grade).toBe('B');
    expect(r.breakdown.crimes).toBe(1);
    expect(r.breakdown.byCrimeSeverity.medium).toBe(1);
  });

  it('one critical crime + one high scam → mixed penalty, grade C', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('mixed');
    await seedCrime({ severity: 'critical' });
    await seedScam(accessToken, { severity: 'high' });
    const r = await getScore(accessToken, { center: ANCHOR });
    // 4×10 (critical crime) + 3×5 (high scam) = 40 + 15 = 55.
    // score = 100 - 55 = 45 → grade D (40..59).
    expect(r.score).toBe(45);
    expect(r.grade).toBe('D');
    expect(r.breakdown.crimes).toBe(1);
    expect(r.breakdown.scams).toBe(1);
    expect(r.breakdown.byCrimeSeverity.critical).toBe(1);
    expect(r.breakdown.byScamSeverity.high).toBe(1);
  });

  it('many high-severity incidents → score bottoms at 0 (grade F)', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('manysev');
    // 4 criticals = 160 penalty; clamps to 0.
    for (let i = 0; i < 4; i++) {
      await seedCrime({ severity: 'critical', latOffset: 0.001 * (i + 1), lngOffset: 0.001 });
    }
    const r = await getScore(accessToken, { center: ANCHOR });
    expect(r.score).toBe(0);
    expect(r.grade).toBe('F');
    expect(r.breakdown.crimes).toBe(4);
  });

  it('incidents outside the radius don’t count', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('outside');
    // 100km away (well outside 2km default).
    await seedCrime({ severity: 'critical', latOffset: 0.9, lngOffset: 0 });
    const r = await getScore(accessToken, { center: ANCHOR });
    expect(r.score).toBe(100);
    expect(r.breakdown.crimes).toBe(0);
  });

  it('radiusKm > 10 → 422 INVALID_RADIUS', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('badradius');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/score',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { center: ANCHOR, radiusKm: 50 },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('INVALID_RADIUS');
  });

  it('SOS events are NOT factored into the score (privacy invariant)', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('sos');
    // Trigger an SOS at the score's query coord.
    const sos = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/sos',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { center: ANCHOR, trigger: 'user_tap' },
    });
    expect(sos.statusCode).toBe(201);
    // No crime / scam in the area.
    const r = await getScore(accessToken, { center: ANCHOR });
    // If SOS leaked in, the score would be < 100. It must stay 100.
    expect(r.score).toBe(100);
    expect(r.grade).toBe('A');
    expect(r.breakdown.crimes).toBe(0);
    expect(r.breakdown.scams).toBe(0);
  });
});
