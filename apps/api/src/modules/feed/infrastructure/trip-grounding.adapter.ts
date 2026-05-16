/**
 * POST.2C.3 — TripGroundingPort impl (the agent → feed inbound seam).
 *
 * Embeds the agent's destination/situation text via the SAME
 * best-effort EmbeddingPort used on publish, finds the nearest
 * visible PUBLISHED trips, and returns short snippets the planner can
 * be grounded with. EVERY failure mode degrades to `[]` so the agent
 * proposes UNGROUNDED rather than crashing (LAW 1) and so a hard
 * dimension bug can't break re-planning (the repo guard still blocks
 * a bad query). Visibility + block filtering happens in the repo
 * predicate — this adapter never widens it (LAW 2).
 *
 * Installed by prompt [POST.2C.3].
 */
import { Inject, Injectable } from '@nestjs/common';
import { createLogger, type AppLogger } from '@app/logger';
import {
  TRIP_PUBLICATION_REPOSITORY,
  type TripPublicationRepository,
} from '../application/ports/trip-publication.repository';
import { EMBEDDING_PORT, type EmbeddingPort } from '../application/ports/embedding.port';
import type {
  TripGroundingPort,
  TripGroundingQuery,
} from '../application/ports/trip-grounding.port';

const MAX_SNIPPETS = 5;

@Injectable()
export class TripGroundingAdapter implements TripGroundingPort {
  private readonly logger: AppLogger = createLogger('feed.trip-grounding');

  constructor(
    @Inject(EMBEDDING_PORT) private readonly embeddings: EmbeddingPort,
    @Inject(TRIP_PUBLICATION_REPOSITORY)
    private readonly pubs: TripPublicationRepository,
  ) {}

  async retrieve(q: TripGroundingQuery): Promise<readonly string[]> {
    const limit = Math.max(1, Math.min(Math.floor(q.limit) || 1, MAX_SNIPPETS));
    try {
      const vec = await this.embeddings.embed(q.text);
      if (vec === null) {
        return []; // Ollama/model absent → ungrounded (not an error)
      }
      const hits = await this.pubs.findSimilarByVector([...vec], q.viewerId, limit);
      return hits.map((h) => `${h.title} — a real published trip near this destination`);
    } catch (err) {
      // Grounding is an enhancement, never a dependency: a wrong-dim
      // vector / DB hiccup must not break the agent's re-plan.
      this.logger.warn(
        { viewerId: q.viewerId, err: err instanceof Error ? err.message : String(err) },
        'trip_grounding_degraded_to_ungrounded',
      );
      return [];
    }
  }
}
