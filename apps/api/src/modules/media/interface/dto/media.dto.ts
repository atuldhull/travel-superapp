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

/**
 * Memory-book schemas. Same id-shape tolerance as TripIdSchema
 * (cuid vs UUID mixed in the DB) — the repo's owner-gated lookup
 * is the real existence check.
 */
const MemoryBookIdSchema = z.string().trim().min(1).max(64);

export const CreateMemoryBookBodySchema = z.object({
  title: z.string().trim().min(1).max(120),
  theme: z.string().trim().max(32).optional(),
  coverS3Key: z.string().trim().max(512).nullable().optional(),
});
export type CreateMemoryBookBody = z.infer<typeof CreateMemoryBookBodySchema>;

export const UpdateMemoryBookBodySchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  theme: z.string().trim().min(1).max(32).optional(),
  coverS3Key: z.string().trim().max(512).nullable().optional(),
});
export type UpdateMemoryBookBody = z.infer<typeof UpdateMemoryBookBodySchema>;

/**
 * Body for `PATCH /media/:id/memory-book`. Same null-or-string
 * shape as `AttachMediaToTripBody`.
 */
export const AttachMediaToBookBodySchema = z.object({
  memoryBookId: MemoryBookIdSchema.nullable(),
});
export type AttachMediaToBookBody = z.infer<typeof AttachMediaToBookBodySchema>;

/**
 * Body for `PATCH /memory-books/:id/assets/:assetId/caption`. V.UX.11
 * lets owners write per-asset narrative for story-mode viewing.
 * Empty / blank caption = clear (server stores `null`).
 */
export const UpdateAssetCaptionBodySchema = z.object({
  caption: z.string().trim().max(280).nullable(),
});
export type UpdateAssetCaptionBody = z.infer<typeof UpdateAssetCaptionBodySchema>;

/**
 * Body for `PATCH /memory-books/:id/asset-order`. V.UX.12 lets
 * owners persist a drag-and-drop reordering of the attached
 * assets. Cap at 500 rows — way past any realistic memory-book
 * size, but still bounds the transaction the repo will open.
 */
export const ReorderBookAssetsBodySchema = z.object({
  assetIds: z.array(z.string().trim().min(1).max(64)).min(1).max(500),
});
export type ReorderBookAssetsBody = z.infer<typeof ReorderBookAssetsBodySchema>;
