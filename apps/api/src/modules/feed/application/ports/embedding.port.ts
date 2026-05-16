/**
 * POST.2C.2 — outbound port: text → trip embedding.
 *
 * The 2.0 fusion flywheel indexes PUBLISHED trips into pgvector so
 * (a) the agent can ground a re-plan in real prior outcomes (Seam 2,
 * POST.2C.3) and (b) a "trips like this" discovery rail works. The
 * embedding source is the ALREADY-RUNNING local Ollama embeddings
 * endpoint — no Python sidecar, no key, no new dependency, $0.
 *
 * Contract:
 *   - `embed` returns a 1024-dim vector, OR `null` when embedding is
 *     unavailable (Ollama / model absent or the call failed). `null`
 *     means "skip-index": the publication still succeeds, just
 *     unindexed. Infra failure NEVER throws here (best-effort, like
 *     the 1.0 Sharp variant pipeline).
 *   - 1024 matches `PlaceEmbedding` + `TripPublication.embedding`. A
 *     vector of any other length is a hard model-config bug (Verified
 *     facts) — `assertEmbeddingDimension` rejects it LOUDLY *before
 *     any DB write* (this guard is NOT swallowed by best-effort).
 *
 * Installed by prompt [POST.2C.2].
 */

/** Established embedding dimension — see `PlaceEmbedding` + migration
 *  20260420081604_vector_ivfflat. 2.0 MUST match for index/op-class
 *  consistency with `VectorQueries`. */
export const EMBEDDING_DIMENSIONS = 1024;

export const EMBEDDING_PORT = Symbol('EmbeddingPort');

export interface EmbeddingPort {
  /** Text → 1024-dim vector, or `null` to skip-index (unavailable /
   *  best-effort failure). Implementations MUST NOT throw on infra
   *  failure — they degrade to `null`. */
  embed(text: string): Promise<number[] | null>;
}

/**
 * Dimension guard. A non-1024 vector is a hard model-config bug
 * ("an embedding model emitting any other dimension is a hard bug"
 * — Verified codebase facts), so it is thrown LOUDLY and *before any
 * DB write*. This is deliberately distinct from the best-effort
 * skip-index path: an absent/failed Ollama yields `null` (silent,
 * publication proceeds); a wrong-length vector is a defect that must
 * surface, never reach pgvector, and never corrupt the ivfflat index.
 */
export function assertEmbeddingDimension(vec: readonly number[]): void {
  if (vec.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${vec.length}`,
    );
  }
}
