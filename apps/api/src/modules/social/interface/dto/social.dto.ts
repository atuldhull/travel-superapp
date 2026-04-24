/**
 * Zod schemas for the Social (voting) endpoints. Keeps the
 * targetType surface narrow — only `itinerary_item` today. Places
 * + restaurants become votable in follow-up slices once their
 * read surfaces render vote counts.
 *
 * Installed by prompt [IV.18.12.3].
 */
import { z } from 'zod';

export const VoteTargetTypeSchema = z.enum(['itinerary_item']);
export const VoteValueSchema = z.union([z.literal(-1), z.literal(0), z.literal(1)]);

export const CastVoteBodySchema = z.object({
  targetType: VoteTargetTypeSchema,
  targetId: z.string().trim().min(1).max(64),
  value: VoteValueSchema,
});
export type CastVoteBody = z.infer<typeof CastVoteBodySchema>;

export const RevokeVoteBodySchema = z.object({
  targetType: VoteTargetTypeSchema,
  targetId: z.string().trim().min(1).max(64),
});
export type RevokeVoteBody = z.infer<typeof RevokeVoteBodySchema>;
