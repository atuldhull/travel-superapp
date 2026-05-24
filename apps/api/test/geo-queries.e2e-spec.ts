/**
 * Integration test for `GeoQueries` — exercises the real PostGIS
 * extension in the running Docker Postgres. Skips if Postgres isn't
 * reachable so the suite stays useful offline.
 *
 * Acceptance (from prompt [III.12.2]): insert 3 places, query within
 * 5km of one, get 2 back; type inference works without casts.
 *
 * Installed by prompt [III.12.2].
 */
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { GeoQueries } from '../src/common/db/geo-queries';
import { PrismaService } from '../src/common/db/prisma.service';

const SOURCE_PREFIX = 'geo-queries-test';

// Central London reference. Victoria Station.
const LONDON = { lat: 51.4952, lng: -0.1441 };
// Hyde Park — ~3 km from Victoria.
const HYDE_PARK = { lat: 51.5073, lng: -0.1657 };
// Trafalgar Square — ~1.7 km from Victoria.
const TRAFALGAR = { lat: 51.5074, lng: -0.1278 };
// Windsor — ~35 km from Victoria. Out of the 5-km radius.
const WINDSOR = { lat: 51.4839, lng: -0.6044 };

describe('GeoQueries (integration, requires Docker Postgres)', () => {
  let moduleRef: TestingModule;
  let geo: GeoQueries;
  let prisma: PrismaService;
  let dbReachable = true;

  beforeAll(async () => {
    // Compile the DI graph but DO NOT create an HTTP app — GeoQueries
    // only needs DI-resolved PrismaService; pulling in Fastify just to
    // stand this up is wasted boot cost.
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = moduleRef.get(PrismaService);
    geo = moduleRef.get(GeoQueries);
    try {
      // $queryRaw against a trivial value probes the connection.
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`geo-queries integration test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    await prisma.place.deleteMany({
      where: { sourceKey: { startsWith: SOURCE_PREFIX } },
    });
  });

  afterAll(async () => {
    // `moduleRef.close()` triggers `onModuleDestroy` on `PrismaService`
    // which disconnects the client. Safe even if init failed.
    await moduleRef.close();
  });

  it('inserts 3 places; finding within 5 km of Victoria returns 2 (Hyde Park + Trafalgar, not Windsor)', async () => {
    if (!dbReachable) {
      return;
    }

    const hydePark = await geo.insertPlace({
      sourceKey: `${SOURCE_PREFIX}-hyde-park`,
      name: 'Hyde Park',
      category: 'park',
      lat: HYDE_PARK.lat,
      lng: HYDE_PARK.lng,
    });
    const trafalgar = await geo.insertPlace({
      sourceKey: `${SOURCE_PREFIX}-trafalgar`,
      name: 'Trafalgar Square',
      category: 'landmark',
      lat: TRAFALGAR.lat,
      lng: TRAFALGAR.lng,
    });
    const windsor = await geo.insertPlace({
      sourceKey: `${SOURCE_PREFIX}-windsor`,
      name: 'Windsor Castle',
      category: 'castle',
      lat: WINDSOR.lat,
      lng: WINDSOR.lng,
    });

    expect(hydePark.id).toBeTruthy();
    expect(trafalgar.id).toBeTruthy();
    expect(windsor.id).toBeTruthy();

    // Filter to this test's own rows so rows seeded by parallel
    // specs (e.g. `index-usage.e2e-spec.ts` seeding near Victoria)
    // can't pollute the count assertion. Tests share the same DB in
    // parallel workers; the PostGIS radius query is correct — it's
    // the "count is 2" assertion that needs scoping.
    const all = await geo.findPlacesWithinRadius({
      lat: LONDON.lat,
      lng: LONDON.lng,
      radiusKm: 5,
    });
    const results = all.filter((r) => r.sourceKey.startsWith(SOURCE_PREFIX));

    expect(results).toHaveLength(2);
    const names = results.map((r) => r.name);
    expect(names).toContain('Hyde Park');
    expect(names).toContain('Trafalgar Square');
    expect(names).not.toContain('Windsor Castle');

    // Nearest first — Hyde Park (~2 km) before Trafalgar (~1.7 km)?
    // Actually Trafalgar is closer. Assert by distance, not name order.
    expect(results[0]!.distanceMeters).toBeLessThan(results[1]!.distanceMeters);

    // Type inference without casts: every row is `Place & { distanceMeters }`.
    for (const row of results) {
      expect(typeof row.distanceMeters).toBe('number');
      expect(row.distanceMeters).toBeGreaterThan(0);
      expect(row.distanceMeters).toBeLessThan(5_000);
      expect(typeof row.name).toBe('string');
      expect(row.category).toBeTruthy();
    }
  });

  it('filters by category when provided', async () => {
    await geo.insertPlace({
      sourceKey: `${SOURCE_PREFIX}-hyde-park`,
      name: 'Hyde Park',
      category: 'park',
      lat: HYDE_PARK.lat,
      lng: HYDE_PARK.lng,
    });
    await geo.insertPlace({
      sourceKey: `${SOURCE_PREFIX}-trafalgar`,
      name: 'Trafalgar Square',
      category: 'landmark',
      lat: TRAFALGAR.lat,
      lng: TRAFALGAR.lng,
    });

    const parksOnly = await geo.findPlacesWithinRadius({
      lat: LONDON.lat,
      lng: LONDON.lng,
      radiusKm: 5,
      filters: { category: 'park' },
    });

    expect(parksOnly).toHaveLength(1);
    expect(parksOnly[0]?.name).toBe('Hyde Park');
  });

  it('updatePlaceCoordinates moves a place and the query sees the new position', async () => {
    const place = await geo.insertPlace({
      sourceKey: `${SOURCE_PREFIX}-windsor`,
      name: 'Windsor Castle',
      category: 'landmark',
      lat: WINDSOR.lat,
      lng: WINDSOR.lng,
    });

    // Windsor is >5km from Victoria — not found.
    const before = await geo.findPlacesWithinRadius({
      lat: LONDON.lat,
      lng: LONDON.lng,
      radiusKm: 5,
    });
    expect(before.find((r) => r.id === place.id)).toBeUndefined();

    // Move it on top of Hyde Park.
    const updated = await geo.updatePlaceCoordinates(place.id, HYDE_PARK.lat, HYDE_PARK.lng);
    expect(updated).toBe(1);

    const after = await geo.findPlacesWithinRadius({
      lat: LONDON.lat,
      lng: LONDON.lng,
      radiusKm: 5,
    });
    expect(after.find((r) => r.id === place.id)).toBeDefined();
  });

  it('updatePlaceCoordinates returns 0 when no row matches', async () => {
    const updated = await geo.updatePlaceCoordinates('place-does-not-exist', 0, 0);
    expect(updated).toBe(0);
  });
});
