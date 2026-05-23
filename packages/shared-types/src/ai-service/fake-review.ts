/**
 * ai-service `/v1/fake-review/score` — DistilBERT classifier.
 *
 * Authored from `docs/services/ai-service/contract.md` §2.
 * Installed by prompt [A5].
 */
import { z } from 'zod';

export const FakeReviewLabel = z.enum(['real', 'suspicious', 'fake']);
export type FakeReviewLabel = z.infer<typeof FakeReviewLabel>;

export const FakeReviewScoreInputReview = z.object({
  id: z.string(),
  authorId: z.string(),
  body: z.string().min(1).max(8_000),
  postedAt: z.string().datetime(),
});
export type FakeReviewScoreInputReview = z.infer<typeof FakeReviewScoreInputReview>;

export const FakeReviewScoreRequest = z.object({
  reviews: z.array(FakeReviewScoreInputReview).min(1).max(100),
});
export type FakeReviewScoreRequest = z.infer<typeof FakeReviewScoreRequest>;

export const FakeReviewScoreResult = z.object({
  id: z.string(),
  /** 1.0 = highly likely fake. */
  score: z.number().min(0).max(1),
  label: FakeReviewLabel,
  reasons: z.array(z.string()).max(4),
});
export type FakeReviewScoreResult = z.infer<typeof FakeReviewScoreResult>;

export const FakeReviewScoreResponse = z.object({
  results: z.array(FakeReviewScoreResult),
});
export type FakeReviewScoreResponse = z.infer<typeof FakeReviewScoreResponse>;
