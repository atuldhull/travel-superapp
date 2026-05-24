/**
 * Integration tests for the federated → catalog write-through path
 * ([IV.18.4.2]). Same recording-provider override pattern as
 * `places-federated.e2e-spec.ts`, with these new properties:
 *
 *   - `ingest=true` returns `placeId` + `created` per result and
 *     persists matching `Place` rows.
 *   - Repeated ingest is idempotent: same `sourceKey` finds the
 *     existing row, no duplicate insert, `created=false`.
 *   - `POST /places/search` near the same coord then finds the
 *     ingested rows — proves the federation layer feeds the
 *     canonical catalog end-to-end.
 *   - Default behaviour (no `ingest`) writes nothing.
 *
 * Each test uses a unique provider+externalId combo so DB cleanup
 * is name-scoped and parallel test suites don't race.
 *
 * Installed by prompt [IV.18.4.2].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import Redis from 'ioredis';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import type {
  FederatedPlaceSearchInput,
  PlaceProvider,
} from '../src/modules/places/application/ports/place-provider';
import type { FederatedPlaceResult } from '../src/modules/places/domain/federated-place-result.entity';
import { MockPlaceProvider } from '../src/modules/places/infrastructure/mock-place-provider';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'places-ingest-e2e';
// Suite-local coord — far from other suites' anchors (see
// memory/feedback_unique_test_coords.md).
const ANCHOR = { lat: -12.3456, lng: 88.7654 };

class StubPlaceProvider implements PlaceProvider {
  async search(input: FederatedPlaceSearchInput): Promise<readonly FederatedPlaceResult[]> {
    // Deterministic three-result fixture pinned to the exact input
    // coord so distances are stable across runs. ExternalId carries
    // the lat/lng so each suite-local ANCHOR generates distinct
    // sourceKeys — DB cleanup is name-scoped, but unique keys
    // also keep this test idempotent.
    const tag = `${input.lat.toFixed(4)}-${input.lng.toFixed(4)}`;
    const all: FederatedPlaceResult[] = [
      {
        externalId: `mock:${TEST_PREFIX}-museum-${tag}`,
        provider: 'mock',
        name: `${TEST_PREFIX}-Museum`,
        category: 'museum',
        address: 'Museum St 1',
        countryCode: 'XX',
        lat: input.lat + 0.001,
        lng: input.lng + 0.001,
        distanceMeters: 150,
      },
      {
        externalId: `mock:${TEST_PREFIX}-cafe-${tag}`,
        provider: 'mock',
        name: `${TEST_PREFIX}-Cafe`,
        category: 'cafe',
        address: 'Cafe St 2',
        countryCode: 'XX',
        lat: input.lat + 0.002,
        lng: input.lng + 0.002,
        distanceMeters: 320,
      },
      {
        externalId: `mock:${TEST_PREFIX}-park-${tag}`,
        provider: 'mock',
        name: `${TEST_PREFIX}-Park`,
        category: 'park',
        address: null,
        countryCode: null,
        lat: input.lat + 0.004,
        lng: input.lng + 0.004,
        distanceMeters: 640,
      },
    ];
    return all.filter((r) => (input.category ? r.category === input.category.toLowerCase() : true));
  }
}

describe('Places federated ingest write-through (integration, requires Postgres + Redis)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let dbReachable = true;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MockPlaceProvider)
      .useValue(new StubPlaceProvider())
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await app.register(fastifyCookie);
    try {
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
      prisma = moduleRef.get(PrismaService);
      await prisma.$queryRaw`SELECT 1`;

      // Wipe federated-search cache so prior runs don't shadow the
      // stub provider's responses.
      const flush = new Redis(process.env['REDIS_URL']!, {
        lazyConnect: false,
        maxRetriesPerRequest: 2,
      });
      try {
        const stream = flush.scanStream({
          match: `travel-${process.env['NODE_ENV']}:places-search:*`,
          count: 100,
        });
        for await (const keys of stream as unknown as AsyncIterable<string[]>) {
          if (keys.length > 0) await flush.del(...keys);
        }
      } finally {
        await flush.quit();
      }

      // Belt-and-braces: drop any leftover Place rows from a prior
      // crashed run.
      await prisma.place.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`places-ingest test: infra not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (!dbReachable) return;
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
    await prisma.place.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
  });

  afterAll(async () => {
    if (dbReachable) {
      await app.close();
    }
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

  it('ingest=true persists rows + returns canonical placeId per result', async () => {
    if (!dbReachable) return;
    const tok = await token('ingest');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/places/federated-search',
      headers: { authorization: `Bearer ${tok}` },
      payload: {
        center: ANCHOR,
        radiusKm: 5,
        ingest: true,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      results: Array<{
        externalId: string;
        placeId?: string;
        created?: boolean;
        name: string;
      }>;
    };
    expect(body.results).toHaveLength(3);
    for (const r of body.results) {
      expect(r.placeId).toMatch(/^[0-9a-f-]{20,}$/i);
      expect(r.created).toBe(true);
    }
    const dbCount = await prisma.place.count({
      where: { name: { startsWith: TEST_PREFIX } },
    });
    expect(dbCount).toBe(3);
  });

  it('repeat ingest is idempotent — no duplicate rows, created=false on second pass', async () => {
    if (!dbReachable) return;
    const tok = await token('idem');
    const payload = {
      center: ANCHOR,
      radiusKm: 5,
      ingest: true,
    };

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/places/federated-search',
      headers: { authorization: `Bearer ${tok}` },
      payload,
    });
    expect(first.statusCode).toBe(200);
    const firstBody = JSON.parse(first.body) as {
      results: Array<{ placeId: string; created: boolean }>;
    };
    expect(firstBody.results.every((r) => r.created)).toBe(true);

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/places/federated-search',
      headers: { authorization: `Bearer ${tok}` },
      payload,
    });
    expect(second.statusCode).toBe(200);
    const secondBody = JSON.parse(second.body) as {
      results: Array<{ placeId: string; created: boolean }>;
    };
    expect(secondBody.results.every((r) => !r.created)).toBe(true);
    // PlaceIds are stable across calls.
    for (let i = 0; i < firstBody.results.length; i++) {
      expect(secondBody.results[i]!.placeId).toBe(firstBody.results[i]!.placeId);
    }
    const dbCount = await prisma.place.count({
      where: { name: { startsWith: TEST_PREFIX } },
    });
    expect(dbCount).toBe(3);
  });

  it('default (no ingest flag) does NOT write through — DB row count stays 0', async () => {
    if (!dbReachable) return;
    const tok = await token('readonly');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/places/federated-search',
      headers: { authorization: `Bearer ${tok}` },
      payload: { center: ANCHOR, radiusKm: 5 },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      results: Array<{ placeId?: string; created?: boolean }>;
    };
    // No placeId / created decoration on a pure read.
    for (const r of body.results) {
      expect(r.placeId).toBeUndefined();
      expect(r.created).toBeUndefined();
    }
    const dbCount = await prisma.place.count({
      where: { name: { startsWith: TEST_PREFIX } },
    });
    expect(dbCount).toBe(0);
  });

  it('ingested rows are findable via POST /places/search (canonical catalog read)', async () => {
    if (!dbReachable) return;
    const tok = await token('roundtrip');

    // 1) Federated ingest.
    const ingest = await app.inject({
      method: 'POST',
      url: '/api/v1/places/federated-search',
      headers: { authorization: `Bearer ${tok}` },
      payload: { center: ANCHOR, radiusKm: 5, ingest: true },
    });
    expect(ingest.statusCode).toBe(200);

    // 2) Catalog search at the same anchor returns the rows we just wrote.
    const search = await app.inject({
      method: 'POST',
      url: '/api/v1/places/search',
      headers: { authorization: `Bearer ${tok}` },
      payload: { center: ANCHOR, radiusKm: 5 },
    });
    expect(search.statusCode).toBe(200);
    const body = JSON.parse(search.body) as {
      places: Array<{ name: string; distanceMeters: number }>;
    };
    const ours = body.places.filter((p) => p.name.startsWith(TEST_PREFIX));
    expect(ours.length).toBe(3);
    expect(ours.map((p) => p.name).sort()).toEqual(
      [`${TEST_PREFIX}-Museum`, `${TEST_PREFIX}-Cafe`, `${TEST_PREFIX}-Park`].sort(),
    );
  });

  it('ingest with category filter only persists matching results', async () => {
    if (!dbReachable) return;
    const tok = await token('catfilter');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/places/federated-search',
      headers: { authorization: `Bearer ${tok}` },
      payload: { center: ANCHOR, radiusKm: 5, category: 'cafe', ingest: true },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { results: Array<{ name: string }> };
    expect(body.results).toHaveLength(1);
    expect(body.results[0]!.name).toBe(`${TEST_PREFIX}-Cafe`);
    const dbCount = await prisma.place.count({
      where: { name: { startsWith: TEST_PREFIX } },
    });
    expect(dbCount).toBe(1);
  });
});
