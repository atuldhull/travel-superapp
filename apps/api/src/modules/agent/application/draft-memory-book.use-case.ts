/**
 * POST.2C.1 — Seam 1: when a trip-watch closes, the agent asks the
 * media module (via the TRIP_BOOK_DRAFTER inbound port) to compose a
 * PRIVATE Memory Book draft from the finished trip. The agent never
 * makes it public — it only produces a draft for the owner to
 * review (the SAFE boundary; LAW 2).
 *
 * Idempotent: a closed run records a `watch_closed` AgentStep
 * carrying the drafted book id; re-invoking returns that id and
 * does NOT create a second book.
 *
 * The scheduler trigger (detect a trip has ended → close the watch →
 * invoke this) is the deferred agent↔trip integration seam (same as
 * the 2A.3 coord / 2A.4 itinerary seams): the trip-ended detection
 * needs trip data the decoupled agent doesn't own. This use-case —
 * the verifiable Seam-1 core — is fully wired + tested.
 *
 * Installed by prompt [POST.2C.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { createLogger, type AppLogger } from '@app/logger';
import { AGENT_RUN_REPOSITORY, type AgentRunRepository } from './ports/agent-run.repository';
import {
  TRIP_BOOK_DRAFTER_PORT,
  type TripBookDrafter,
} from '../../media/application/ports/trip-book-drafter.port';

export interface DraftMemoryBookCommand {
  readonly agentRunId: string;
  readonly tripId: string;
  readonly ownerId: string;
  readonly title: string;
}

export interface DraftMemoryBookResult {
  readonly memoryBookId: string;
  /** true when a prior close already produced the draft. */
  readonly alreadyDrafted: boolean;
}

function bookIdFromStepDetail(detail: Readonly<Record<string, unknown>> | null): string | null {
  if (detail === null) return null;
  const v = detail['memoryBookId'];
  return typeof v === 'string' ? v : null;
}

@Injectable()
export class DraftMemoryBookUseCase {
  private readonly logger: AppLogger = createLogger('agent.draft-memory-book');

  constructor(
    @Inject(TRIP_BOOK_DRAFTER_PORT) private readonly drafter: TripBookDrafter,
    @Inject(AGENT_RUN_REPOSITORY) private readonly runs: AgentRunRepository,
  ) {}

  async execute(cmd: DraftMemoryBookCommand): Promise<DraftMemoryBookResult> {
    // Idempotency — never produce a second book for the same run.
    const steps = await this.runs.listSteps(cmd.agentRunId);
    for (const s of steps) {
      if (s.kind === 'watch_closed') {
        const existing = bookIdFromStepDetail(s.detail);
        if (existing !== null) {
          return { memoryBookId: existing, alreadyDrafted: true };
        }
      }
    }

    const { memoryBookId } = await this.drafter.draftFromTrip({
      tripId: cmd.tripId,
      ownerId: cmd.ownerId,
      title: cmd.title,
    });
    await this.runs.appendStep({
      agentRunId: cmd.agentRunId,
      kind: 'watch_closed',
      detail: { memoryBookId, tripId: cmd.tripId },
    });
    this.logger.info(
      { agentRunId: cmd.agentRunId, tripId: cmd.tripId, memoryBookId },
      'memory_book_drafted',
    );
    return { memoryBookId, alreadyDrafted: false };
  }
}
