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
  /**
   * V.UX.14 — list of `PlaceTag.value` values (under key='feature')
   * that a place must carry to pass. Family-mode UI sends e.g.
   * `['kid_friendly', 'stroller_accessible']`.
   */
  requiredFeatures: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
  /** V.UX.17 — premium curated-only filter. */
  curatedOnly: z.boolean().optional(),
});
export type SearchPlacesBody = z.infer<typeof SearchPlacesBodySchema>;

/**
 * Federated search body — external provider(s) only. `ingest`
 * defaults to false: federated-search remains a pure read in
 * the no-flag case so test isolation + speed are preserved.
 * Set `ingest: true` to write the results through to the
 * canonical `Place` catalog (idempotent via sha256-anchored
 * sourceKey dedup); response then carries the canonical
 * `placeId` per result. [IV.18.4.2]
 */
export const FederatedSearchPlacesBodySchema = z.object({
  center: Coord,
  radiusKm: z.number().positive().max(10_000),
  category: z.string().trim().min(1).max(60).optional(),
  ingest: z.boolean().optional(),
});
export type FederatedSearchPlacesBody = z.infer<typeof FederatedSearchPlacesBodySchema>;

/**
 * V.UX.19 — hidden-gem discovery. Same coord shape as search,
 * but the use-case caps radius at 300km (day-trip distance) and
 * limit at 50.
 */
export const DiscoverHiddenGemsBodySchema = z.object({
  center: Coord,
  radiusKm: z.number().positive().max(10_000),
  category: z.string().trim().min(1).max(60).optional(),
  limit: z.number().int().positive().max(50).optional(),
});
export type DiscoverHiddenGemsBody = z.infer<typeof DiscoverHiddenGemsBodySchema>;
