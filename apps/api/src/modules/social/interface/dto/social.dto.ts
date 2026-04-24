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

/**
 * Body for `POST /trips/:tripId/expenses`. Amount is a string at
 * the wire so we don't lose precision on money values (the
 * use-case enforces the `^\d+(\.\d{1,2})?$` shape + `> 0` bound).
 * splitShare is a free-form `{userId: number}` map; the use-case
 * enforces sum==1.0, share∈(0,1], and payer-present invariants.
 */
export const CreateExpenseBodySchema = z.object({
  amountUsd: z.string().trim().min(1).max(20),
  currency: z.string().trim().length(3),
  note: z.string().trim().max(500).nullable().optional(),
  splitShare: z
    .record(z.string().min(1), z.number().positive().max(1))
    .refine((s) => Object.keys(s).length > 0, { message: 'splitShare must be non-empty' }),
});
export type CreateExpenseBody = z.infer<typeof CreateExpenseBodySchema>;
