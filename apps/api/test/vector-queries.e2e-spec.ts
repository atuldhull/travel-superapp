/**
 * Integration test for `VectorQueries` — exercises the real pgvector
 * extension + IVFFlat index in the running Docker Postgres. Skips if
 * Postgres isn't reachable.
 *
 * Acceptance (from prompt [III.12.3]): insert 100 deterministic
 * 1024-dim vectors; `findSimilar` returns the nearest 5 correctly.
 *
 * Installed by prompt [III.12.3].
 */
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { GeoQueries } from '../src/common/db/geo-queries';
import { PrismaService } from '../src/common/db/prisma.service';
import { VectorQueries } from '../src/common/db/vector-queries';

const SOURCE_PREFIX = 'vector-queries-test';
const N = 100;
const DIM = 1024;

/**
 * Deterministic embedding for a given index. All zeros except the
 * first component, which is `idx * 0.01`. L2 distance between
 * vector(i) and vector(j) is therefore `|i-j| * 0.01`. Ordering by
 * distance gives a predictable ranking — the 5 nearest to target 42
 * are (42, 41 or 43, 43 or 41, 40 or 44, 44 or 40).
 */
function makeVector(idx: number): number[] {
  const v = new Array<number>(DIM).fill(0);
  v[0] = idx * 0.01;
  return v;
}

describe('VectorQueries (integration, requires Docker Postgres)', () => {
  let moduleRef: TestingModule;
  let geo: GeoQueries;
  let vec: VectorQueries;
  let prisma: PrismaService;
  let dbReachable = true;
  const placeIdByIdx = new Map<number, string>();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = moduleRef.get(PrismaService);
    geo = moduleRef.get(GeoQueries);
    vec = moduleRef.get(VectorQueries);

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`vector-queries integration test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
      return;
    }

    // Seed: 100 Places + 100 embeddings. Places share a dummy location
    // — this test doesn't exercise geo.
    for (let i = 0; i < N; i++) {
      const place = await geo.insertPlace({
        sourceKey: `${SOURCE_PREFIX}-${i}`,
        name: `P${i}`,
        category: 'embedding-test',
        lat: 0,
        lng: 0,
      });
      placeIdByIdx.set(i, place.id);
      await vec.upsertEmbedding(place.id, makeVector(i));
    }
  }, 60_000); // 60s timeout — 200 SQL round-trips can take a while.

  afterAll(async () => {
    if (dbReachable) {
      await prisma.placeEmbedding.deleteMany({
        where: { placeId: { in: Array.from(placeIdByIdx.values()) } },
      });
      await prisma.place.deleteMany({
        where: { sourceKey: { startsWith: SOURCE_PREFIX } },
      });
    }
    await moduleRef.close();
  });

  it('findSimilar returns the 5 nearest placeIds in ascending-distance order', async () => {
    if (!dbReachable) return;

    const targetIdx = 42;
    const target = makeVector(targetIdx);

    const results = await vec.findSimilar(target, 5);
    expect(results).toHaveLength(5);

    // The closest result MUST be the target itself (distance ~0).
    expect(results[0]!.placeId).toBe(placeIdByIdx.get(targetIdx));
    expect(results[0]!.distance).toBeLessThan(1e-5);

    // Distances non-decreasing.
    for (let i = 1; i < results.length; i++) {
      expect(results[i]!.distance).toBeGreaterThanOrEqual(results[i - 1]!.distance);
    }

    // The top-5 set MUST be exactly indices {40, 41, 42, 43, 44} —
    // their L2 distances to target 42 are 0.02, 0.01, 0, 0.01, 0.02.
    const idxByPlaceId = new Map<string, number>();
    for (const [idx, id] of placeIdByIdx) idxByPlaceId.set(id, idx);
    const topIndices = new Set(results.map((r) => idxByPlaceId.get(r.placeId)));
    expect(topIndices).toEqual(new Set([40, 41, 42, 43, 44]));
  });

  it('upsertEmbedding replaces an existing row in place (1:1 placeId constraint)', async () => {
    if (!dbReachable) return;

    const idx = 7;
    const placeId = placeIdByIdx.get(idx)!;

    // Re-upsert with a different vector; row count should stay at 1.
    const replacement = new Array<number>(DIM).fill(0);
    replacement[0] = 9.99;
    await vec.upsertEmbedding(placeId, replacement, 'test-replacement');

    const countRows = await prisma.placeEmbedding.findMany({
      where: { placeId },
      select: { placeId: true, model: true },
    });
    expect(countRows).toHaveLength(1);
    expect(countRows[0]!.model).toBe('test-replacement');

    // Find nearest to the replacement vector: should return this row first.
    const results = await vec.findSimilar(replacement, 1);
    expect(results[0]!.placeId).toBe(placeId);

    // Put the original back so later tests stay deterministic.
    await vec.upsertEmbedding(placeId, makeVector(idx));
  });

  it('rejects wrong-dimension vectors at the client boundary', async () => {
    if (!dbReachable) return;
    await expect(vec.upsertEmbedding('whatever', [0.1, 0.2, 0.3])).rejects.toThrow(/1024-dim/);
    await expect(vec.findSimilar([0.1, 0.2, 0.3], 5)).rejects.toThrow(/1024-dim/);
  });

  it('rejects non-positive limits', async () => {
    if (!dbReachable) return;
    await expect(vec.findSimilar(makeVector(0), 0)).rejects.toThrow(/positive integer/);
    await expect(vec.findSimilar(makeVector(0), -3)).rejects.toThrow(/positive integer/);
  });
});
