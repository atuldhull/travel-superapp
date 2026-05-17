/**
 * Zod schemas for the diary HTTP surface.
 *
 * Installed for the adventure-diary feature.
 */
import { z } from 'zod';

export const CreateDiaryEntryBodySchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(20_000),
  tripId: z.string().min(1).max(64).optional(),
  mood: z.string().max(40).optional(),
  aiAssisted: z.boolean().optional(),
  entryDate: z.string().datetime().optional(),
});
export type CreateDiaryEntryBody = z.infer<typeof CreateDiaryEntryBodySchema>;

export const AssistDiaryBodySchema = z.object({
  mode: z.enum(['prompt', 'polish', 'title']),
  text: z.string().max(20_000).optional(),
  mood: z.string().max(40).optional(),
  place: z.string().max(120).optional(),
});
export type AssistDiaryBody = z.infer<typeof AssistDiaryBodySchema>;
