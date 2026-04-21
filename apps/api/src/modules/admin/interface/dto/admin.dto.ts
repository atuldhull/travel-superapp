/**
 * Zod body schema for `POST /admin/places`. Mirrors the shape
 * the Places search uses for `center`, plus the curation fields
 * only admins touch (sourceKey, address, countryCode, metadata,
 * relaxationScore).
 *
 * Installed by prompt [IV.18.3.1].
 */
import { z } from 'zod';

export const AdminCreatePlaceBodySchema = z.object({
  sourceKey: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(60),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().trim().min(1).max(500).optional().nullable(),
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Z]{2}$/, 'countryCode must be ISO-3166-1 alpha-2 upper case')
    .optional()
    .nullable(),
  // Use-case's own range check is the final word; keep Zod wide so
  // out-of-range values reach the typed domain error instead of the
  // generic VALIDATION_FAILED.
  relaxationScore: z.number().int().min(0).max(100).optional(),
  metadata: z.record(z.unknown()).optional().nullable(),
});
export type AdminCreatePlaceBody = z.infer<typeof AdminCreatePlaceBodySchema>;
