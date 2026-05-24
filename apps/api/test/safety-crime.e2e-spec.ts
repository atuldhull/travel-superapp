/**
 * Integration tests for the crime-layer read surface ([IV.18.11.3]).
 *
 *   POST /api/v1/safety/crimes/search → within-radius query.
 *
 * No user-facing write path exists; tests seed rows directly via
 * `GeoQueries.insertCrimeIncident` (the future ingest worker's
 * path — keeping the seam honest). Each test uses a unique
 * `source` tag so DB cleanup is scoped + parallel suites don't
 * race.
 *
 * Installed by prompt [IV.18.11.3].
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

const SOURCE_PREFIX = 'crime-e2e';
// Mid-South-Atlantic — no other Safety suite seeds near here.
const ANCHOR = { lat: -28.7654, lng: -19.1234 };

interface IncidentResp {
  readonly id: string;
  readonly source: string;
  readonly category: string;
  readonly severity: string;
  readonly reportedAt: string;
  readonly distanceMeters: number;
}

describe('Safety crime-layer (integration, requires Postgres)', () => {
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
      // Drop any leftover rows from a prior crashed run.
      await prisma.crimeIncident.deleteMany({
        where: { source: { startsWith: SOURCE_PREFIX } },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`crime test: infra not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (!dbReachable) return;
    await prisma.crimeIncident.deleteMany({
      where: { source: { startsWith: SOURCE_PREFIX } },
    });
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: SOURCE_PREFIX } },
    });
  });

  afterAll(async () => {
    if (dbReachable) await app.close();
    await moduleRef.close();
  });

  async function token(suffix: string): Promise<string> {
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
    return (JSON.parse(res.body) as { accessToken: string }).accessToken;
  }

  async function seedIncident(opts: {
    category: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    latOffset: number;
    lngOffset: number;
    reportedAt?: Date;
  }): Promise<string> {
    const row = await geo.insertCrimeIncident({
      source: `${SOURCE_PREFIX}-${opts.category}-${uniqueSuffix()}`,
      category: opts.category,
      ...(opts.severity ? { severity: opts.severity } : {}),
      lat: ANCHOR.lat + opts.latOffset,
      lng: ANCHOR.lng + opts.lngOffset,
      reportedAt: opts.reportedAt ?? new Date(),
    });
    return row.id;
  }

  it('POST /safety/crimes/search without a bearer → 401', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/crimes/search',
      payload: { center: ANCHOR, radiusKm: 5 },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('empty DB → 200 with empty incidents list', async () => {
    if (!dbReachable) return;
    const tok = await token('empty');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/crimes/search',
      headers: { authorization: `Bearer ${tok}` },
      payload: { center: ANCHOR, radiusKm: 5 },
    });
    expect(res.statusCode).toBe(200);
    expect((JSON.parse(res.body) as { incidents: unknown[] }).incidents).toEqual([]);
  });

  it('seeded rows → ordered by distance asc within radius', async () => {
    if (!dbReachable) return;
    const tok = await token('ordered');
    const closeId = await seedIncident({ category: 'theft', latOffset: 0.001, lngOffset: 0.001 });
    const midId = await seedIncident({ category: 'theft', latOffset: 0.01, lngOffset: 0.01 });
    const farId = await seedIncident({ category: 'theft', latOffset: 0.03, lngOffset: 0.03 });
    // 100km away — outside the 5km query radius.
    await seedIncident({ category: 'theft', latOffset: 0.9, lngOffset: 0.0 });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/crimes/search',
      headers: { authorization: `Bearer ${tok}` },
      payload: { center: ANCHOR, radiusKm: 5 },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { incidents: IncidentResp[] };
    expect(body.incidents.map((i) => i.id)).toEqual([closeId, midId, farId]);
    // Strictly increasing distance.
    expect(body.incidents[0]!.distanceMeters).toBeLessThan(body.incidents[1]!.distanceMeters);
    expect(body.incidents[1]!.distanceMeters).toBeLessThan(body.incidents[2]!.distanceMeters);
  });

  it('category filter narrows to matching rows only', async () => {
    if (!dbReachable) return;
    const tok = await token('catfilter');
    const theftId = await seedIncident({ category: 'theft', latOffset: 0.001, lngOffset: 0.001 });
    await seedIncident({ category: 'assault', latOffset: 0.002, lngOffset: 0.002 });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/crimes/search',
      headers: { authorization: `Bearer ${tok}` },
      payload: { center: ANCHOR, radiusKm: 5, category: 'theft' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { incidents: IncidentResp[] };
    expect(body.incidents.map((i) => i.id)).toEqual([theftId]);
  });

  it('minSeverity filter is threshold-style (medium → medium/high/critical)', async () => {
    if (!dbReachable) return;
    const tok = await token('sevfilter');
    await seedIncident({
      category: 'theft',
      severity: 'low',
      latOffset: 0.001,
      lngOffset: 0.001,
    });
    const mediumId = await seedIncident({
      category: 'theft',
      severity: 'medium',
      latOffset: 0.002,
      lngOffset: 0.002,
    });
    const highId = await seedIncident({
      category: 'theft',
      severity: 'high',
      latOffset: 0.003,
      lngOffset: 0.003,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/crimes/search',
      headers: { authorization: `Bearer ${tok}` },
      payload: { center: ANCHOR, radiusKm: 5, minSeverity: 'medium' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { incidents: IncidentResp[] };
    expect(body.incidents.map((i) => i.id).sort()).toEqual([mediumId, highId].sort());
  });

  it('sinceDays window excludes older incidents', async () => {
    if (!dbReachable) return;
    const tok = await token('since');
    const recentId = await seedIncident({
      category: 'theft',
      latOffset: 0.001,
      lngOffset: 0.001,
      reportedAt: new Date(),
    });
    // 100 days old — outside a 30-day window.
    await seedIncident({
      category: 'theft',
      latOffset: 0.002,
      lngOffset: 0.002,
      reportedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/crimes/search',
      headers: { authorization: `Bearer ${tok}` },
      payload: { center: ANCHOR, radiusKm: 5, sinceDays: 30 },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { incidents: IncidentResp[] };
    expect(body.incidents.map((i) => i.id)).toEqual([recentId]);
  });

  it('radiusKm > 50 → 422 INVALID_RADIUS', async () => {
    if (!dbReachable) return;
    const tok = await token('badradius');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/crimes/search',
      headers: { authorization: `Bearer ${tok}` },
      payload: { center: ANCHOR, radiusKm: 100 },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('INVALID_RADIUS');
  });

  it('limit caps response length', async () => {
    if (!dbReachable) return;
    const tok = await token('limit');
    for (let i = 0; i < 5; i++) {
      await seedIncident({
        category: 'theft',
        latOffset: 0.001 * (i + 1),
        lngOffset: 0.001 * (i + 1),
      });
    }
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/crimes/search',
      headers: { authorization: `Bearer ${tok}` },
      payload: { center: ANCHOR, radiusKm: 5, limit: 2 },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { incidents: IncidentResp[] };
    expect(body.incidents).toHaveLength(2);
  });
});
