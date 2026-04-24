/**
 * Zod schemas for Media endpoints. `contentType` is permissive
 * (just a non-empty string) — storage-side we trust the client
 * hint, and the ai-service transcoder is the real authority on
 * format. Limits are deliberate belt-and-braces: the presigned
 * URL's signed headers enforce `Content-Type` anyway.
 *
 * Installed by prompt [IV.18.12.1].
 */
import { z } from 'zod';

const MediaKindSchema = z.enum(['image', 'video']);

/**
 * Trip id shape. Mixed cuid + UUID in the DB — raw-SQL inserted
 * rows (Place, Trip, ScamReport, SosEvent) use `randomUUID()`
 * while Prisma-defaulted rows use `cuid()`. A loose `min(1)`
 * string pattern covers both; existence is the real source of
 * truth (enforced by the owner-gate lookup in the use-case).
 */
const TripIdSchema = z.string().trim().min(1).max(64);

export const CreateUploadUrlBodySchema = z.object({
  kind: MediaKindSchema,
  contentType: z.string().trim().min(1).max(120),
  tripId: TripIdSchema.optional(),
});
export type CreateUploadUrlBody = z.infer<typeof CreateUploadUrlBodySchema>;

/**
 * Body for `PATCH /media/:id/trip`. `tripId: null` detaches; a
 * non-empty string attaches. Empty body is rejected by Zod so the
 * client always states intent.
 */
export const AttachMediaToTripBodySchema = z.object({
  tripId: TripIdSchema.nullable(),
});
export type AttachMediaToTripBody = z.infer<typeof AttachMediaToTripBodySchema>;
