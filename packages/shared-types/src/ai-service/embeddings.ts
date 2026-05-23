/**
 * ai-service `/v1/embeddings` — sentence-transformers batched
 * embeddings. Vectors are 1024-dim to match `pgvector(1024)` on
 * `TripPublication.embedding` and `PlaceEmbedding`.
 *
 * Authored from `docs/services/ai-service/contract.md` §2.
 * Installed by prompt [A5].
 */
import { z } from 'zod';

export const EmbeddingsPurpose = z.enum(['place', 'review', 'query']);
export type EmbeddingsPurpose = z.infer<typeof EmbeddingsPurpose>;

/** Dimension of every returned embedding vector. Must match the
 *  `Unsupported("vector(N)")` Prisma columns on both sides. */
export const EMBEDDINGS_DIMENSIONS = 1024 as const;

export const EmbeddingsRequest = z.object({
  inputs: z.array(z.string().min(1).max(2_000)).min(1).max(64),
  purpose: EmbeddingsPurpose,
});
export type EmbeddingsRequest = z.infer<typeof EmbeddingsRequest>;

export const EmbeddingsResponse = z.object({
  model: z.string(),
  dimensions: z.literal(EMBEDDINGS_DIMENSIONS),
  /** `embeddings[i].length === dimensions` for every i. */
  embeddings: z.array(z.array(z.number())),
});
export type EmbeddingsResponse = z.infer<typeof EmbeddingsResponse>;
