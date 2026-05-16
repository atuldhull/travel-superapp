/**
 * POST.2C.3 — Seam 2 (pure/fake, no Postgres, no HTTP, ZERO keys).
 *
 * Proves the load-bearing acceptance criteria without infra:
 *   - groundingPreamble: absent/empty → '' (NON-BREAKING: the planner
 *     prompt is byte-identical to pre-2C.3); present → folded in
 *     (grounded prompt DIFFERS from ungrounded — proves it feeds the LLM)
 *   - propose-replan: grounding is OPTIONAL + BEST-EFFORT (no port /
 *     [] / throw → ungrounded, still proposes; hits → passed through)
 *   - SimilarTripsUseCase.clampLimit bounds the page
 *   - TripGroundingAdapter degrades to [] (no embeddings / repo error)
 *   - LAW 2: the repo similarity SQL ALWAYS carries the visibility +
 *     block + non-private + embedding-not-null predicate (proven by
 *     inspecting the emitted $queryRaw template — no DB needed)
 *
 * Installed by prompt [POST.2C.3].
 */
import { groundingPreamble } from '../src/modules/trip/application/ports/trip-planner.port';
import { ProposeReplanUseCase } from '../src/modules/agent/application/propose-replan.use-case';
import {
  SimilarTripsUseCase,
  clampLimit,
} from '../src/modules/feed/application/similar-trips.use-case';
import { TripGroundingAdapter } from '../src/modules/feed/infrastructure/trip-grounding.adapter';
import { PrismaTripPublicationRepository } from '../src/modules/feed/infrastructure/prisma-trip-publication.repository';
import { EMBEDDING_DIMENSIONS } from '../src/modules/feed/application/ports/embedding.port';
import type { PrismaService } from '../src/common/db/prisma.service';
import type { EmbeddingPort } from '../src/modules/feed/application/ports/embedding.port';
import type {
  TripPublicationRepository,
  SimilarTrip,
} from '../src/modules/feed/application/ports/trip-publication.repository';
import type {
  DraftReplanInput,
  PlanTool,
} from '../src/modules/agent/application/ports/plan-tool.port';
import type { AgentRunRepository } from '../src/modules/agent/application/ports/agent-run.repository';
import type { TripGroundingPort } from '../src/modules/feed/application/ports/trip-grounding.port';

describe('groundingPreamble (POST.2C.3 — non-breaking + grounded differs)', () => {
  it('absent / empty / whitespace → "" (planner prompt unchanged)', () => {
    expect(groundingPreamble()).toBe('');
    expect(groundingPreamble([])).toBe('');
    expect(groundingPreamble(['  ', ''])).toBe('');
  });

  it('present → folded block containing the snippets (capped at 5)', () => {
    const out = groundingPreamble(['Lisbon food walk', 'Sintra day trip']);
    expect(out).toContain('Lisbon food walk');
    expect(out).toContain('Sintra day trip');
    expect(out).toMatch(/Ground your plan/i);
    const many = groundingPreamble(Array.from({ length: 9 }, (_, i) => `trip ${i}`));
    expect((many.match(/^- /gm) ?? []).length).toBe(5); // hard cap
  });

  it('the grounded prompt differs from the ungrounded one', () => {
    expect(groundingPreamble(['x'])).not.toBe(groundingPreamble());
  });
});

describe('ProposeReplanUseCase grounding (OPTIONAL + BEST-EFFORT)', () => {
  const baseCmd = {
    agentRunId: 'r1',
    tripId: 't1',
    ownerId: 'owner1',
    trip: { title: 'Lisbon', lat: 38.72, lng: -9.14, radiusKm: 5, startsOn: null, endsOn: null },
    diffs: [],
    reason: 'storm Tuesday',
  };

  function fakes(): {
    planTool: PlanTool & { lastInput: DraftReplanInput | null };
    runs: AgentRunRepository;
    bus: { publish: jest.Mock };
  } {
    const planTool = {
      lastInput: null as DraftReplanInput | null,
      async draftReplan(input: DraftReplanInput) {
        this.lastInput = input;
        return { summary: 'draft', provider: 'stub' };
      },
    };
    const runs = {
      appendStep: jest.fn().mockResolvedValue({ id: 'step1' }),
    } as unknown as AgentRunRepository;
    const bus = { publish: jest.fn().mockResolvedValue(undefined) };
    return { planTool, runs, bus };
  }

  it('no grounding port → proposes UNGROUNDED (3-arg ctor, non-breaking)', async () => {
    const { planTool, runs, bus } = fakes();
    const uc = new ProposeReplanUseCase(planTool, runs, bus as never);
    await uc.execute(baseCmd);
    expect(planTool.lastInput?.groundingContext).toBeUndefined();
    expect(bus.publish).toHaveBeenCalledTimes(1);
  });

  it('grounding hits → passed through to the planner as groundingContext', async () => {
    const { planTool, runs, bus } = fakes();
    const grounding: TripGroundingPort = { retrieve: async () => ['Real trip A', 'Real trip B'] };
    const uc = new ProposeReplanUseCase(planTool, runs, bus as never, grounding);
    await uc.execute(baseCmd);
    expect(planTool.lastInput?.groundingContext).toEqual(['Real trip A', 'Real trip B']);
  });

  it('grounding [] or throw → swallowed, still proposes UNGROUNDED', async () => {
    for (const g of [
      { retrieve: async () => [] as string[] },
      {
        retrieve: async () => {
          throw new Error('pgvector down');
        },
      },
    ] as TripGroundingPort[]) {
      const { planTool, runs, bus } = fakes();
      const uc = new ProposeReplanUseCase(planTool, runs, bus as never, g);
      await expect(uc.execute(baseCmd)).resolves.toMatchObject({ proposalId: 'step1' });
      expect(planTool.lastInput?.groundingContext).toBeUndefined();
    }
  });
});

describe('SimilarTripsUseCase.clampLimit + delegation', () => {
  it('clamps to [1, 20]', () => {
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(-3)).toBe(1);
    expect(clampLimit(Number.NaN)).toBe(1);
    expect(clampLimit(6)).toBe(6);
    expect(clampLimit(999)).toBe(20);
  });

  it('delegates to repo.findSimilarToPublication with the clamped limit', async () => {
    const calls: Array<[string, string, number]> = [];
    const repo = {
      findSimilarToPublication: async (a: string, b: string, c: number) => {
        calls.push([a, b, c]);
        return [] as readonly SimilarTrip[];
      },
    } as unknown as TripPublicationRepository;
    const uc = new SimilarTripsUseCase(repo);
    await uc.execute({ sourceTripId: 't1', viewerId: 'v1', limit: 999 });
    expect(calls).toEqual([['t1', 'v1', 20]]);
  });
});

describe('TripGroundingAdapter degrades to [] (LAW 1, never breaks the agent)', () => {
  const repoOk = {
    findSimilarByVector: async (): Promise<readonly SimilarTrip[]> => [
      { tripId: 't9', title: 'Porto wine weekend', authorId: 'a9', distance: 0.1 },
    ],
  } as unknown as TripPublicationRepository;

  it('embed → null (Ollama absent) → [] (ungrounded, no crash)', async () => {
    const embeddings: EmbeddingPort = { embed: async () => null };
    const a = new TripGroundingAdapter(embeddings, repoOk);
    await expect(a.retrieve({ viewerId: 'v', text: 'x', limit: 3 })).resolves.toEqual([]);
  });

  it('embed ok → repo hits become snippet strings', async () => {
    const embeddings: EmbeddingPort = {
      embed: async () => new Array(EMBEDDING_DIMENSIONS).fill(0),
    };
    const a = new TripGroundingAdapter(embeddings, repoOk);
    const out = await a.retrieve({ viewerId: 'v', text: 'x', limit: 3 });
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('Porto wine weekend');
  });

  it('repo throws (e.g. dim guard) → [] (best-effort, agent still re-plans)', async () => {
    const embeddings: EmbeddingPort = { embed: async () => [1, 2, 3] };
    const repoThrows = {
      findSimilarByVector: async () => {
        throw new Error('embedding dimension mismatch');
      },
    } as unknown as TripPublicationRepository;
    const a = new TripGroundingAdapter(embeddings, repoThrows);
    await expect(a.retrieve({ viewerId: 'v', text: 'x', limit: 3 })).resolves.toEqual([]);
  });
});

describe('LAW 2 — similarity SQL ALWAYS carries the visibility+block fence', () => {
  // The similarity reads use `$queryRaw(Prisma.sql`…`)` (function-call
  // form) — the arg is a Prisma.Sql whose `.strings` holds the literal
  // SQL skeleton (nested fragments are flattened in by Prisma).
  function repoSpy(): { repo: PrismaTripPublicationRepository; sql: () => string } {
    const captured: string[] = [];
    const prisma = {
      $queryRaw: jest.fn((q: { strings?: readonly string[]; sql?: string }) => {
        captured.push(
          Array.isArray(q?.strings) ? q.strings.join('?') : typeof q?.sql === 'string' ? q.sql : '',
        );
        return Promise.resolve([]);
      }),
    } as unknown as PrismaService;
    return {
      repo: new PrismaTripPublicationRepository(prisma),
      sql: () => captured.join('\n'),
    };
  }

  const ok = new Array(EMBEDDING_DIMENSIONS).fill(0.1);

  it('findSimilarByVector: non-private + embedding-not-null + follow + block + not-own', async () => {
    const { repo, sql } = repoSpy();
    await repo.findSimilarByVector(ok, 'viewer1', 5);
    const s = sql();
    expect(s).toMatch(/visibility <> 'PRIVATE'/);
    expect(s).toMatch(/tp\.embedding IS NOT NULL/);
    expect(s).toMatch(/"authorId" <> /);
    expect(s).toMatch(/FROM "Follow"/);
    expect(s).toMatch(/NOT EXISTS[\s\S]*"UserBlock"/);
    expect(s).toMatch(/embedding <-> /); // L2 ivfflat operator
  });

  it('findSimilarToPublication: same fence + excludes the source trip', async () => {
    const { repo, sql } = repoSpy();
    await repo.findSimilarToPublication('src1', 'viewer1', 5);
    const s = sql();
    expect(s).toMatch(/visibility <> 'PRIVATE'/);
    expect(s).toMatch(/NOT EXISTS[\s\S]*"UserBlock"/);
    expect(s).toMatch(/tp\."tripId" <> /); // source trip excluded
    expect(s).toMatch(/src\.e IS NOT NULL/); // no-embedding source → empty
  });

  it('findSimilarByVector rejects a non-1024 query vector BEFORE the DB', async () => {
    const { repo, sql } = repoSpy();
    await expect(repo.findSimilarByVector([1, 2, 3], 'v', 5)).rejects.toThrow(/got 3/);
    expect(sql()).toBe(''); // guard precedes any $queryRaw
  });
});
