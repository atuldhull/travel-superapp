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

/**
 * Federated search body — external provider(s) only, no local
 * catalog merge (that's a follow-up slice). Same shape as
 * `SearchPlacesBodySchema` minus `limit` (the provider controls
 * result count in v1).
 */
export const FederatedSearchPlacesBodySchema = z.object({
  center: Coord,
  radiusKm: z.number().positive().max(10_000),
  category: z.string().trim().min(1).max(60).optional(),
});
export type FederatedSearchPlacesBody = z.infer<typeof FederatedSearchPlacesBodySchema>;
