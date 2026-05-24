/**
 * Index-usage acceptance test for [III.12.4].
 *
 * Two assertions:
 *   1. Every index required by Playbook §12.4 + the GiST / IVFFlat
 *      indexes from `[III.12.2]` + `[III.12.3]` exist in `pg_indexes`.
 *   2. `EXPLAIN ANALYZE` on a radius query uses the GiST index —
 *      proves the index is actually wired up, not just created.
 *
 * Installed by prompt [III.12.4].
 */
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { GeoQueries } from '../src/common/db/geo-queries';
import { PrismaService } from '../src/common/db/prisma.service';

const SOURCE_PREFIX = 'index-usage-test';

/**
 * Indexes Playbook §12.4 names explicitly + the derived geo/vector
 * indexes from sibling prompts. If this list drifts from reality, the
 * test catches it.
 */
const EXPECTED_INDEXES = [
  // Prisma-declared (§12.4):
  'Trip_userId_status_createdAt_idx',
  'Session_userId_revokedAt_idx',
  'NotificationLog_userId_read_createdAt_idx',
  'User_emailHash_key', // from @@unique
  // Raw-SQL GiST indexes ([III.12.2]):
  'Place_coordinates_gist',
  'Trip_center_gist',
  'Stay_coordinates_gist',
  'Eatery_coordinates_gist',
  'RouteLeg_origin_gist',
  'RouteLeg_destination_gist',
  'CrimeIncident_coordinates_gist',
  'ScamReport_coordinates_gist',
  'SosEvent_coordinates_gist',
  'WeatherForecast_coordinates_gist',
  'Alert_coordinates_gist',
  'Event_coordinates_gist',
  'Geofence_center_gist',
  'MediaAsset_coordinates_gist',
  // IVFFlat on pgvector column ([III.12.3]):
  'PlaceEmbedding_embedding_ivfflat',
] as const;

describe('Index usage acceptance [III.12.4] (integration, requires Docker Postgres)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let geo: GeoQueries;
  let dbReachable = true;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = moduleRef.get(PrismaService);
    geo = moduleRef.get(GeoQueries);
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`index-usage test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterAll(async () => {
    if (dbReachable) {
      await prisma.place.deleteMany({
        where: { sourceKey: { startsWith: SOURCE_PREFIX } },
      });
    }
    await moduleRef.close();
  });

  it('every expected index exists in pg_indexes', async () => {
    const rows = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
    `;
    const actual = new Set(rows.map((r) => r.indexname));
    for (const expected of EXPECTED_INDEXES) {
      expect(actual.has(expected)).toBe(true);
    }
  });

  it('EXPLAIN on a radius query hits Place_coordinates_gist', async () => {
    // Seed a small grid so the planner sees >0 rows. Then ANALYZE to
    // refresh the stats — without that, the planner's defaults may
    // route to a seq-scan on a tiny table. With forced `enable_seqscan
    // = off` the GiST index is the only viable path, proving the index
    // is wired to the query.
    for (let i = 0; i < 25; i++) {
      await geo.insertPlace({
        sourceKey: `${SOURCE_PREFIX}-${i}`,
        name: `P${i}`,
        category: 'test',
        lat: 51.5 + i * 0.001,
        lng: -0.1 + i * 0.001,
      });
    }
    await prisma.$executeRaw`ANALYZE "Place"`;

    // Run EXPLAIN under `SET LOCAL enable_seqscan = off` in a single
    // transaction — the setting reverts on commit. Forces the planner
    // to use the GiST index when available.
    const planRows = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL enable_seqscan = off`;
      return tx.$queryRaw<{ 'QUERY PLAN': string }[]>`
        EXPLAIN
        SELECT id
        FROM "Place"
        WHERE ST_DWithin(
          coordinates,
          ST_SetSRID(ST_MakePoint(-0.1441, 51.4952), 4326)::geography,
          5000
        )
      `;
    });

    const plan = planRows.map((r) => r['QUERY PLAN']).join('\n');
    // Either "Index Scan using Place_coordinates_gist" or "Bitmap
    // Index Scan on Place_coordinates_gist" satisfies us.
    expect(plan).toContain('Place_coordinates_gist');
  });
});
