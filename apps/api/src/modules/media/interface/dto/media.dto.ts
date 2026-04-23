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

export const CreateUploadUrlBodySchema = z.object({
  kind: MediaKindSchema,
  contentType: z.string().trim().min(1).max(120),
  tripId: z.string().cuid().optional(),
});
export type CreateUploadUrlBody = z.infer<typeof CreateUploadUrlBodySchema>;
