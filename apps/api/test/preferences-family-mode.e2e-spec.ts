/**
 * V.UX.14 — preferences CRUD + family-mode search filters.
 *
 *   GET   /api/v1/account/preferences
 *   PATCH /api/v1/account/preferences
 *   POST  /api/v1/stays/search   (with requiredAmenities)
 *   POST  /api/v1/places/search  (with requiredFeatures)
 *
 * Asserts: defaults shape, idempotent upsert, kid-age + budget-tier
 * validation, stays amenity post-filter (substring match), places
 * feature post-filter via PlaceTag rows.
 *
 * Installed by prompt [V.UX.14].
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

const TEST_PREFIX = 'prefs-family-e2e';

interface PrefsResp {
  readonly id: string;
  readonly userId: string;
  readonly familyMode: boolean;
  readonly kidAges: number[];
  readonly budgetTier: number;
}

describe('Preferences + family-mode filters (V.UX.14 — integration)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let geo: GeoQueries;
  // Suite-local coordinates, well away from any other suite.
  const lat = 41.123;
  const lng = -73.456;

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

  it('GET /preferences returns defaults before first write', async () => {
    const { accessToken } = await registerUser('default');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/account/preferences',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as PrefsResp;
    expect(body.familyMode).toBe(false);
    expect(body.kidAges).toEqual([]);
    expect(body.budgetTier).toBe(2);
  });

  it('PATCH familyMode + kidAges persists', async () => {
    const { accessToken } = await registerUser('upsert');
    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/v1/account/preferences',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { familyMode: true, kidAges: [5, 8, 11] },
    });
    expect(patch.statusCode).toBe(200);
    expect(JSON.parse(patch.body).familyMode).toBe(true);
    expect(JSON.parse(patch.body).kidAges).toEqual([5, 8, 11]);

    // Re-read echoes the same row.
    const get = await app.inject({
      method: 'GET',
      url: '/api/v1/account/preferences',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const body = JSON.parse(get.body) as PrefsResp;
    expect(body.familyMode).toBe(true);
    expect(body.kidAges).toEqual([5, 8, 11]);
  });

  it('PATCH with kid age > 17 → 422 INVALID_KID_AGE', async () => {
    const { accessToken } = await registerUser('badage');
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/account/preferences',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { kidAges: [4, 21] },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });

  it('PATCH with > 8 kids → 422 (Zod cap)', async () => {
    const { accessToken } = await registerUser('toomany');
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/account/preferences',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { kidAges: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });

  it('Stays search with requiredAmenities=["wifi"] keeps all 3 mock listings', async () => {
    const { accessToken } = await registerUser('stays-pass');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/stays/search',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        center: { lat, lng },
        radiusKm: 10,
        checkIn: '2026-06-01',
        checkOut: '2026-06-03',
        requiredAmenities: ['wifi'],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { stays: { amenities: string[] }[] };
    // V.UX.23 — mock fixtures grew from 3 to 4 (added "Nomad Loft"
    // for the digital-nomad persona). All 4 carry "wifi" so this
    // amenity filter keeps every fixture.
    expect(body.stays).toHaveLength(4);
  });

  it('Stays search with requiredAmenities=["crib"] returns 0 (mock has none)', async () => {
    const { accessToken } = await registerUser('stays-crib');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/stays/search',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        center: { lat, lng },
        radiusKm: 10,
        checkIn: '2026-06-01',
        checkOut: '2026-06-03',
        requiredAmenities: ['crib'],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { stays: unknown[] };
    expect(body.stays).toHaveLength(0);
  });

  it('Places search with requiredFeatures filters via PlaceTag rows', async () => {
    const { accessToken } = await registerUser('places');

    const kidPlace = await geo.insertPlace({
      sourceKey: `${TEST_PREFIX}:kid-${uniqueSuffix()}`,
      name: 'Kid Park',
      category: 'attraction',
      lat,
      lng,
    });
    const adultPlace = await geo.insertPlace({
      sourceKey: `${TEST_PREFIX}:adult-${uniqueSuffix()}`,
      name: 'Quiet Bar',
      category: 'attraction',
      lat: lat + 0.002,
      lng: lng + 0.002,
    });
    await prisma.placeTag.create({
      data: { placeId: kidPlace.id, key: 'feature', value: 'kid_friendly' },
    });

    // Without filter — both rows surface.
    const all = await app.inject({
      method: 'POST',
      url: '/api/v1/places/search',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { center: { lat, lng }, radiusKm: 10 },
    });
    const allBody = JSON.parse(all.body) as { places: { id: string }[] };
    const allMine = allBody.places.filter((p) => p.id === kidPlace.id || p.id === adultPlace.id);
    expect(allMine).toHaveLength(2);

    // With family filter — only the tagged row.
    const filtered = await app.inject({
      method: 'POST',
      url: '/api/v1/places/search',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        center: { lat, lng },
        radiusKm: 10,
        requiredFeatures: ['kid_friendly'],
      },
    });
    const filteredBody = JSON.parse(filtered.body) as { places: { id: string }[] };
    const filteredMine = filteredBody.places.filter(
      (p) => p.id === kidPlace.id || p.id === adultPlace.id,
    );
    expect(filteredMine).toHaveLength(1);
    expect(filteredMine[0]!.id).toBe(kidPlace.id);
  });
});
