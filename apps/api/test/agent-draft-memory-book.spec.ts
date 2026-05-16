/**
 * POST.2C.1 — Seam 1 unit tests (pure/fake, no infra).
 *
 * Proves: the agent draft is IDEMPOTENT (one book per run, ever);
 * the drafted book is a PRIVATE draft (publishedAt = null) produced
 * via CreateMemoryBookUseCase — the agent never publishes (LAW 2).
 *
 * Installed by prompt [POST.2C.1].
 */
import type { AgentRun } from '../src/modules/agent/domain/agent-run.entity';
import type { AgentStep } from '../src/modules/agent/domain/agent-step.entity';
import type {
  AgentRunRepository,
  AppendAgentStepInput,
  CreateAgentRunInput,
} from '../src/modules/agent/application/ports/agent-run.repository';
import type { TripBookDrafter } from '../src/modules/media/application/ports/trip-book-drafter.port';
import { DraftMemoryBookUseCase } from '../src/modules/agent/application/draft-memory-book.use-case';
import { DraftBookFromTripUseCase } from '../src/modules/media/application/draft-book-from-trip.use-case';
import type { CreateMemoryBookUseCase } from '../src/modules/media/application/create-memory-book.use-case';
import type { MemoryBook } from '../src/modules/media/domain/memory-book.entity';

let seq = 0;
const NOW = new Date('2026-05-16T00:00:00.000Z');

class FakeRuns implements AgentRunRepository {
  steps: AgentStep[] = [];
  async create(i: CreateAgentRunInput): Promise<AgentRun> {
    return {
      id: `run-${++seq}`,
      tripId: i.tripId,
      status: 'watching',
      planVersion: 1,
      createdAt: NOW,
      updatedAt: NOW,
    };
  }
  async findById(): Promise<AgentRun | null> {
    return null;
  }
  async appendStep(i: AppendAgentStepInput): Promise<AgentStep> {
    const s: AgentStep = {
      id: `step-${++seq}`,
      agentRunId: i.agentRunId,
      kind: i.kind,
      detail: i.detail ?? null,
      createdAt: NOW,
    };
    this.steps.push(s);
    return s;
  }
  async listSteps(runId: string): Promise<readonly AgentStep[]> {
    return this.steps.filter((s) => s.agentRunId === runId);
  }
  async getStep(stepId: string): Promise<AgentStep | null> {
    return this.steps.find((s) => s.id === stepId) ?? null;
  }
  async bumpPlanVersion(): Promise<void> {
    /* unused here */
  }
}

describe('DraftMemoryBookUseCase (POST.2C.1, idempotent + private)', () => {
  beforeEach(() => {
    seq = 0;
  });

  it('first close → drafts one PRIVATE book + records a watch_closed step', async () => {
    const runs = new FakeRuns();
    let calls = 0;
    const drafter: TripBookDrafter = {
      draftFromTrip: async () => {
        calls += 1;
        return { memoryBookId: 'book-1' };
      },
    };
    const uc = new DraftMemoryBookUseCase(drafter, runs);

    const res = await uc.execute({
      agentRunId: 'run-X',
      tripId: 't1',
      ownerId: 'owner',
      title: 'Lisbon long weekend',
    });

    expect(res).toEqual({ memoryBookId: 'book-1', alreadyDrafted: false });
    expect(calls).toBe(1);
    const steps = await runs.listSteps('run-X');
    expect(steps).toHaveLength(1);
    expect(steps[0]?.kind).toBe('watch_closed');
    expect(steps[0]?.detail).toEqual({ memoryBookId: 'book-1', tripId: 't1' });
  });

  it('closing twice never produces a second book (idempotent)', async () => {
    const runs = new FakeRuns();
    let calls = 0;
    const drafter: TripBookDrafter = {
      draftFromTrip: async () => {
        calls += 1;
        return { memoryBookId: `book-${calls}` };
      },
    };
    const uc = new DraftMemoryBookUseCase(drafter, runs);

    const a = await uc.execute({ agentRunId: 'r', tripId: 't', ownerId: 'o', title: 'T' });
    const b = await uc.execute({ agentRunId: 'r', tripId: 't', ownerId: 'o', title: 'T' });

    expect(a.memoryBookId).toBe('book-1');
    expect(b).toEqual({ memoryBookId: 'book-1', alreadyDrafted: true });
    expect(calls).toBe(1); // drafter NOT called the second time
    expect((await runs.listSteps('r')).length).toBe(1); // no second step
  });
});

describe('DraftBookFromTripUseCase (POST.2C.1, PRIVATE draft, no publish)', () => {
  it('creates a book via CreateMemoryBookUseCase with publishedAt null', async () => {
    let createdWith: { ownerId: string; title: string; theme?: string } | null = null;
    const book: MemoryBook = {
      id: 'mb-1',
      ownerId: 'owner',
      title: 'Lisbon long weekend',
      coverS3Key: null,
      theme: 'classic',
      publishedAt: null, // ← PRIVATE draft
      createdAt: NOW,
      updatedAt: NOW,
    };
    const fakeCreate = {
      execute: async (cmd: { ownerId: string; title: string; theme?: string }) => {
        createdWith = cmd;
        return book;
      },
    } as unknown as CreateMemoryBookUseCase;

    const uc = new DraftBookFromTripUseCase(fakeCreate);
    const out = await uc.draftFromTrip({
      tripId: 't1',
      ownerId: 'owner',
      title: 'Lisbon long weekend',
    });

    expect(out).toEqual({ memoryBookId: 'mb-1' });
    expect(createdWith).toEqual({
      ownerId: 'owner',
      title: 'Lisbon long weekend',
      theme: 'classic',
    });
    expect(book.publishedAt).toBeNull(); // the drafted book is PRIVATE
  });
});
