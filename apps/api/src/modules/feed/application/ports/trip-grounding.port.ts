/**
 * POST.2C.3 — Seam 2 INBOUND port (modules/feed exposes this; the
 * agent depends on it). Keeps the hex direction correct: agent →
 * feed, never feed → agent (same stance as the 2C.1
 * TRIP_BOOK_DRAFTER agent→media seam).
 *
 * `retrieve` returns short, already-safe grounding snippets from real
 * PUBLISHED trips nearest the query text (pgvector L2), with the
 * visibility + block filters applied INSIDE the use-case — the agent
 * never sees content the trip owner couldn't see (LAW 2,
 * NON-NEGOTIABLE). Best-effort: no embeddings / Ollama absent → `[]`
 * (the agent then proposes UNGROUNDED — no crash, LAW 1).
 *
 * Installed by prompt [POST.2C.3].
 */
export const TRIP_GROUNDING_PORT = Symbol('TripGroundingPort');

export interface TripGroundingQuery {
  /** The trip owner — visibility + block filters are applied AS this
   *  viewer (the agent acts on the owner's behalf, never wider). */
  readonly viewerId: string;
  /** Free-text describing the destination/situation to ground. */
  readonly text: string;
  /** Top-k cap (defaults applied by the adapter). */
  readonly limit: number;
}

export interface TripGroundingPort {
  retrieve(q: TripGroundingQuery): Promise<readonly string[]>;
}
