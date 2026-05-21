/**
 * POST.2C.2 — trip embeddings (pure/fake, no Postgres, no HTTP).
 *
 * Proves the three load-bearing acceptance criteria WITHOUT infra:
 *   - dimension guard REJECTS a non-1024 vector BEFORE any DB write
 *   - embed-on-publish is BEST-EFFORT (Ollama failure ≠ publish failure)
 *   - unpublish NULLs `embedding` in the SAME single SQL statement as
 *     the visibility flip (atomic de-index — proven by inspecting the
 *     one `$executeRaw` template the repo emits)
 *   - the stub adapter returns null ($0 / zero-key skip-index)
 *
 * Installed by prompt [POST.2C.2].
 */
import {
  assertEmbeddingDimension,
  EMBEDDING_DIMENSIONS,
} from '../src/modules/feed/application/ports/embedding.port';
import { StubEmbeddingAdapter } from '../src/modules/feed/infrastructure/stub-embedding.adapter';
import { PrismaTripPublicationRepository } from '../src/modules/feed/infrastructure/prisma-trip-publication.repository';
import { PublishTripUseCase } from '../src/modules/feed/application/publish-trip.use-case';
import type { PrismaService } from '../src/common/db/prisma.service';
import type { EmbeddingPort } from '../src/modules/feed/application/ports/embedding.port';
import type { TripPublication } from '../src/modules/feed/domain/trip-publication.entity';
import type { TripPublicationRepository } from '../src/modules/feed/application/ports/trip-publication.repository';
import type { TripRepository } from '../src/modules/trip/application/ports/trip.repository';
import type { GeoQueries } from '../src/common/db/geo-queries';

const NOW = new Date('2026-05-16T00:00:00.000Z');
const YESTERDAY = new Date('2026-05-15T00:00:00.000Z');
const ok1024 = (): number[] => new Array(EMBEDDING_DIMENSIONS).fill(0.1);

describe('assertEmbeddingDimension (POST.2C.2 — guard before DB write)', () => {
  it('accepts exactly 1024 dims', () => {
    expect(() => assertEmbeddingDimension(ok1024())).not.toThrow();
  });

  it('rejects any other length (768 / 3 / 0) — a hard model-config bug', () => {
    expect(() => assertEmbeddingDimension(new Array(768).fill(0))).toThrow(
      /expected 1024, got 768/,
    );
    expect(() => assertEmbeddingDimension([1, 2, 3])).toThrow(/got 3/);
    expect(() => assertEmbeddingDimension([])).toThrow(/got 0/);
  });
});

describe('StubEmbeddingAdapter (POST.2C.2 — $0 skip-index)', () => {
  it('always returns null so publish/unpublish work with zero keys', async () => {
    const stub: EmbeddingPort = new StubEmbeddingAdapter();
    await expect(stub.embed('anything')).resolves.toBeNull();
  });
});

describe('PrismaTripPublicationRepository.setEmbedding (guard BEFORE any DB write)', () => {
  function repoWithSpy(): { repo: PrismaTripPublicationRepository; calls: string[][] } {
    const calls: string[][] = [];
    const prisma = {
      // Prisma tagged-template: first arg is the TemplateStringsArray.
      $executeRaw: jest.fn((strings: TemplateStringsArray) => {
        calls.push([...strings]);
        return Promise.resolve(1);
      }),
    } as unknown as PrismaService;
    return { repo: new PrismaTripPublicationRepository(prisma), calls };
  }

  it('null vector → NO-OP, never touches the DB (skip-index, keep prior)', async () => {
    const { repo, calls } = repoWithSpy();
    await repo.setEmbedding('t1', 'a1', null);
    expect(calls).toHaveLength(0);
  });

  it('non-1024 vector → THROWS and never writes (guard precedes DB)', async () => {
    const { repo, calls } = repoWithSpy();
    await expect(repo.setEmbedding('t1', 'a1', [1, 2, 3])).rejects.toThrow(/got 3/);
    expect(calls).toHaveLength(0); // proven: rejected BEFORE any DB write
  });

  it('valid 1024 vector → ONE parameterized ::vector UPDATE', async () => {
    const { repo, calls } = repoWithSpy();
    await repo.setEmbedding('t1', 'a1', ok1024());
    expect(calls).toHaveLength(1);
    const sql = calls[0]!.join('?');
    expect(sql).toMatch(/UPDATE "TripPublication"/);
    expect(sql).toMatch(/embedding = .*::vector/s);
  });
});

describe('setPrivate de-indexes in the SAME statement as the visibility flip', () => {
  it('emits ONE UPDATE that flips visibility AND NULLs embedding (atomic)', async () => {
    const calls: string[][] = [];
    const prisma = {
      $executeRaw: jest.fn((strings: TemplateStringsArray) => {
        calls.push([...strings]);
        return Promise.resolve(1);
      }),
    } as unknown as PrismaService;
    const repo = new PrismaTripPublicationRepository(prisma);

    await repo.setPrivate('t1', 'owner');

    expect(calls).toHaveLength(1); // single statement = one implicit tx
    const sql = calls[0]!.join('?');
    expect(sql).toMatch(/visibility = 'PRIVATE'/);
    expect(sql).toMatch(/embedding = NULL/);
    expect(sql).toMatch(/"publishedAt" = NULL/);
    // Both mutations live in the SAME template → cannot leave a ghost
    // vector for an unpublished trip.
  });
});

describe('PublishTripUseCase embed-on-publish is BEST-EFFORT', () => {
  const geo = {
    findTripCenter: async () => ({ lat: 48.8566, lng: 2.3522 }),
  } as unknown as GeoQueries;

  const trips = {
    findByIdForUser: async (id: string, userId: string) =>
      userId === 'owner'
        ? { id, userId, title: 'Lisbon', radiusKm: 5, startsOn: YESTERDAY, endsOn: YESTERDAY }
        : null,
  } as unknown as TripRepository;

  class FakePubs implements TripPublicationRepository {
    last: TripPublication | null = null;
    setEmbeddingCalls: Array<[string, string, number[] | null]> = [];
    setEmbeddingThrows = false;
    async upsertPublish(i: {
      tripId: string;
      authorId: string;
      memoryBookId: string | null;
      visibility: TripPublication['visibility'];
      exposedLat: number | null;
      exposedLng: number | null;
      publishedAt: Date;
    }): Promise<TripPublication> {
      this.last = { id: 'pub1', ...i, createdAt: NOW, updatedAt: NOW };
      return this.last;
    }
    async setPrivate(): Promise<void> {}
    async setEmbedding(t: string, a: string, e: number[] | null): Promise<void> {
      this.setEmbeddingCalls.push([t, a, e]);
      if (this.setEmbeddingThrows) throw new Error('embedding dimension mismatch: got 768');
    }
    async findByTrip(): Promise<TripPublication | null> {
      return this.last;
    }
    async listFeed(): Promise<readonly TripPublication[]> {
      return [];
    }
    async listByAuthorVisibleTo(): Promise<readonly TripPublication[]> {
      return [];
    }
    async countPublishedByAuthor(): Promise<number> {
      return 0;
    }
    async countFollowers(): Promise<number> {
      return 0;
    }
    // POST.2C.3 — port grew (similarity reads); not exercised here.
    async findSimilarByVector(): Promise<readonly never[]> {
      return [];
    }
    async findSimilarToPublication(): Promise<readonly never[]> {
      return [];
    }
    // Phase 5 (J3/J5) — discovery reads; not exercised here.
    async listSuggestedTravellers(): Promise<readonly never[]> {
      return [];
    }
    async findTripBuddies(): Promise<readonly never[]> {
      return [];
    }
  }

  it('Ollama unavailable (embed→null): publish STILL succeeds, skip-index', async () => {
    const pubs = new FakePubs();
    const embeddings: EmbeddingPort = { embed: async () => null };
    const uc = new PublishTripUseCase(trips, geo, pubs, embeddings);

    const out = await uc.execute({ tripId: 't1', userId: 'owner' });

    expect(out.id).toBe('pub1'); // publish committed regardless
    expect(pubs.setEmbeddingCalls).toEqual([['t1', 'owner', null]]);
  });

  it('embed returns a 1024 vector → it is handed to setEmbedding', async () => {
    const pubs = new FakePubs();
    const vec = ok1024();
    const embeddings: EmbeddingPort = { embed: async () => vec };
    const uc = new PublishTripUseCase(trips, geo, pubs, embeddings);

    await uc.execute({ tripId: 't1', userId: 'owner' });

    expect(pubs.setEmbeddingCalls[0]?.[2]).toBe(vec);
  });

  it('a dimension-mismatch throw is SWALLOWED — publish never fails on it', async () => {
    const pubs = new FakePubs();
    pubs.setEmbeddingThrows = true; // simulate the loud guard firing
    const embeddings: EmbeddingPort = { embed: async () => new Array(768).fill(0) };
    const uc = new PublishTripUseCase(trips, geo, pubs, embeddings);

    // Best-effort: the user's publish resolves even though indexing blew up.
    await expect(uc.execute({ tripId: 't1', userId: 'owner' })).resolves.toMatchObject({
      id: 'pub1',
    });
  });
});
