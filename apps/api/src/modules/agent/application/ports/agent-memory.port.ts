/**
 * POST.2A.1 — port for the agent's episodic recall.
 *
 * Declared here so the hex contract is fixed early; bound to a
 * pgvector adapter in POST.2C.2 (local Ollama `mxbai-embed-large`,
 * 1024-dim — matches the existing PlaceEmbedding precedent). No
 * implementation is registered in this skeleton slice.
 *
 * Installed by prompt [POST.2A.1].
 */

export interface AgentMemoryRecallQuery {
  readonly text: string;
  readonly limit: number;
}

export interface AgentMemoryHit {
  readonly id: string;
  /** Cosine/L2 similarity score from pgvector (0..1, higher = closer). */
  readonly score: number;
  readonly summary: string;
}

export interface AgentMemory {
  recall(query: AgentMemoryRecallQuery): Promise<readonly AgentMemoryHit[]>;
}

export const AGENT_MEMORY_PORT = Symbol('AgentMemory');
