/**
 * Zod schema for the Place search endpoint. Mirrors the shape the
 * Trip module's Create body uses so client code can reuse its
 * coord + radius primitives.
 *
 * Installed by prompt [IV.18.2.9].
 */
import { z } from 'zod';

const Coord = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const SearchPlacesBodySchema = z.object({
  center: Coord,
  // Use-case enforces the 0 < x ≤ 50 cap — keep Zod loose so the
  // typed `INVALID_RADIUS` wins on 51+.
  radiusKm: z.number().positive().max(10_000),
  category: z.string().trim().min(1).max(60).optional(),
  limit: z.number().int().positive().max(100).optional(),
});
export type SearchPlacesBody = z.infer<typeof SearchPlacesBodySchema>;
