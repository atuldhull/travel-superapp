/**
 * V.UX.17 — premium concierge agent-match + curatedOnly places.
 *
 *   POST /api/v1/agents/match-for-trip   (@Roles('premium','admin'))
 *   POST /api/v1/places/search           (curatedOnly via PlaceTag)
 *
 * Asserts: non-premium → 403; non-owner → 404; verified-only filter
 * (drops `pending` rows); region-match (case-sensitive exact);
 * top-3 cap; PlaceTag `curated` filter on places.
 *
 * Installed by prompt [V.UX.17].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { GeoQueries } from '../src/common/db/geo-queries';
import { uniqueEmail, uniqueSuffix } from './factories';

const TEST_PREFIX = 'concierge-e2e';

interface AgentMatchResp {
  readonly id: string;
  readonly displayName: string;
  readonly regions: string[];
  readonly ratingAverage: number;
  readonly ratingCount: number;
}

describe('Concierge agent-match + curatedOnly (V.UX.17 — integration)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let geo: GeoQueries;

  const lat = 39.012;
  const lng = -98.012;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await app.register(fastifyCookie);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = moduleRef.get(PrismaService);
    geo = moduleRef.get(GeoQueries);
    await prisma.$queryRaw`SELECT 1`;
  });

  afterEach(async () => {
    // Cascades User -> Agent through Agent.userId FK.
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
    await prisma.place.deleteMany({
      where: { sourceKey: { startsWith: `${TEST_PREFIX}:` } },
    });
  });

  afterAll(async () => {
    await app.close();
    await moduleRef.close();
  });

  async function registerUser(
    suffix: string,
  ): Promise<{ userId: string; accessToken: string; email: string; password: string }> {
    const email = uniqueEmail(`${TEST_PREFIX}-${suffix}`);
    const password = 'correct-horse-battery-staple';
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password,
        displayName: `${TEST_PREFIX}-${suffix}`,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { userId: string; accessToken: string };
    return { userId: body.userId, accessToken: body.accessToken, email, password };
  }

  /**
   * Bump role server-side, then re-login to get a token whose `role`
   * claim matches the new DB value (the JwtAuthGuard reads from the
   * token, not the DB). Same shape as admin-users.e2e-spec.
   */
  async function loginAsPremium(suffix: string): Promise<{ token: string; userId: string }> {
    const reg = await registerUser(suffix);
    await prisma.user.update({ where: { id: reg.userId }, data: { role: 'premium' } });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: reg.email, password: reg.password },
    });
    expect(login.statusCode).toBe(200);
    return {
      token: (JSON.parse(login.body) as { accessToken: string }).accessToken,
      userId: reg.userId,
    };
  }

  async function createTrip(token: string, suffix: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: `${TEST_PREFIX}-${suffix}`,
        center: { lat, lng },
        radiusKm: 10,
      },
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { id: string }).id;
  }

  async function seedAgent(input: {
    suffix: string;
    regions: readonly string[];
    rating: number;
    ratingCount: number;
    kycStatus: 'verified' | 'pending';
  }): Promise<string> {
    const reg = await registerUser(`agent-${input.suffix}`);
    const agent = await prisma.agent.create({
      data: {
        userId: reg.userId,
        displayName: `${TEST_PREFIX}-agent-${input.suffix}`,
        regions: [...input.regions],
        ratingAverage: input.rating,
        ratingCount: input.ratingCount,
        kycStatus: input.kycStatus,
        verifiedAt: input.kycStatus === 'verified' ? new Date() : null,
      },
    });
    return agent.id;
  }

  it('non-premium caller → 403 ROLE_FORBIDDEN', async () => {
    const reg = await registerUser('basic');
    const tripId = await createTrip(reg.accessToken, 'basic-trip');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/agents/match-for-trip',
      headers: { authorization: `Bearer ${reg.accessToken}` },
      payload: { tripId },
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).code).toBe('ROLE_FORBIDDEN');
  });

  it('premium caller, foreign tripId → 404 TRIP_NOT_FOUND', async () => {
    const alice = await registerUser('a');
    const aliceTripId = await createTrip(alice.accessToken, 'alice');
    const bob = await loginAsPremium('b');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/agents/match-for-trip',
      headers: { authorization: `Bearer ${bob.token}` },
      payload: { tripId: aliceTripId },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('TRIP_NOT_FOUND');
  });

  it('premium caller, valid trip → returns top 3 verified agents (drops pending)', async () => {
    const me = await loginAsPremium('me');
    const tripId = await createTrip(me.token, 'mine');

    await seedAgent({
      suffix: 'top',
      regions: ['france'],
      rating: 4.9,
      ratingCount: 50,
      kycStatus: 'verified',
    });
    await seedAgent({
      suffix: 'mid',
      regions: ['france'],
      rating: 4.5,
      ratingCount: 20,
      kycStatus: 'verified',
    });
    await seedAgent({
      suffix: 'low',
      regions: ['france'],
      rating: 4.0,
      ratingCount: 10,
      kycStatus: 'verified',
    });
    await seedAgent({
      suffix: 'extra',
      regions: ['france'],
      rating: 3.9,
      ratingCount: 5,
      kycStatus: 'verified',
    });
    await seedAgent({
      suffix: 'pending',
      regions: ['france'],
      rating: 5.0,
      ratingCount: 200,
      kycStatus: 'pending',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/agents/match-for-trip',
      headers: { authorization: `Bearer ${me.token}` },
      payload: { tripId, region: 'france' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { matches: AgentMatchResp[] };
    expect(body.matches).toHaveLength(3);
    // Pending is dropped despite higher rating.
    expect(body.matches.find((m) => m.displayName.endsWith('pending'))).toBeUndefined();
    // Sorted by rating desc.
    expect(body.matches[0]!.ratingAverage).toBeGreaterThanOrEqual(body.matches[1]!.ratingAverage);
    expect(body.matches[1]!.ratingAverage).toBeGreaterThanOrEqual(body.matches[2]!.ratingAverage);
  });

  it('region filter excludes agents outside the destination', async () => {
    const me = await loginAsPremium('region');
    const tripId = await createTrip(me.token, 'region');

    await seedAgent({
      suffix: 'fr',
      regions: ['france'],
      rating: 4.0,
      ratingCount: 10,
      kycStatus: 'verified',
    });
    await seedAgent({
      suffix: 'jp',
      regions: ['japan'],
      rating: 5.0,
      ratingCount: 100,
      kycStatus: 'verified',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/agents/match-for-trip',
      headers: { authorization: `Bearer ${me.token}` },
      payload: { tripId, region: 'france' },
    });
    const body = JSON.parse(res.body) as { matches: AgentMatchResp[] };
    expect(body.matches.length).toBeGreaterThan(0);
    for (const m of body.matches) expect(m.regions).toContain('france');
  });

  it('places curatedOnly filter keeps only PlaceTag curated=true rows', async () => {
    const me = await loginAsPremium('curated');

    const curated = await geo.insertPlace({
      sourceKey: `${TEST_PREFIX}:curated-${uniqueSuffix()}`,
      name: 'Hand-picked Bistro',
      category: 'restaurant',
      lat,
      lng,
    });
    const generic = await geo.insertPlace({
      sourceKey: `${TEST_PREFIX}:generic-${uniqueSuffix()}`,
      name: 'Chain Hotel',
      category: 'restaurant',
      lat: lat + 0.002,
      lng: lng + 0.002,
    });
    await prisma.placeTag.create({
      data: { placeId: curated.id, key: 'curated', value: 'true' },
    });

    const all = await app.inject({
      method: 'POST',
      url: '/api/v1/places/search',
      headers: { authorization: `Bearer ${me.token}` },
      payload: { center: { lat, lng }, radiusKm: 10 },
    });
    const allBody = JSON.parse(all.body) as { places: { id: string }[] };
    const allMine = allBody.places.filter((p) => p.id === curated.id || p.id === generic.id);
    expect(allMine).toHaveLength(2);

    const filtered = await app.inject({
      method: 'POST',
      url: '/api/v1/places/search',
      headers: { authorization: `Bearer ${me.token}` },
      payload: { center: { lat, lng }, radiusKm: 10, curatedOnly: true },
    });
    const filteredBody = JSON.parse(filtered.body) as { places: { id: string }[] };
    const filteredMine = filteredBody.places.filter(
      (p) => p.id === curated.id || p.id === generic.id,
    );
    expect(filteredMine).toHaveLength(1);
    expect(filteredMine[0]!.id).toBe(curated.id);
  });
});
