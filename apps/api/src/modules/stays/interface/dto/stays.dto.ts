/**
 * Zod schema for `POST /stays/search`. Mirrors the Places + Weather
 * shape for center + radius so client code can reuse the same DTO
 * primitives.
 *
 * Installed by prompt [IV.18.6.1].
 */
import { z } from 'zod';

const Coord = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const SearchStaysBodySchema = z.object({
  center: Coord,
  // Use-case's INVALID_RADIUS wins above 50 — keep Zod loose so the
  // typed domain error surfaces instead of VALIDATION_FAILED.
  radiusKm: z.number().positive().max(10_000),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  guests: z.number().int().positive().max(20).optional(),
  /**
   * V.UX.14 — when set, a listing must include every requested
   * amenity (case-insensitive substring match). Family-mode UI
   * sends `['crib', 'high_chair', 'stroller_accessible']`.
   */
  requiredAmenities: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
});
export type SearchStaysBody = z.infer<typeof SearchStaysBodySchema>;
