/**
 * Zod schema for `POST /eateries/search`. Center + radius primitives
 * match Stays + Places so client code can share DTO helpers.
 *
 * Installed by prompt [IV.18.7.1].
 */
import { z } from 'zod';

const Coord = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const SearchEateriesBodySchema = z.object({
  center: Coord,
  // Use-case's INVALID_RADIUS wins above 25 — keep Zod loose.
  radiusKm: z.number().positive().max(10_000),
  cuisineTag: z.string().trim().min(1).max(40).optional(),
  maxPriceTier: z.number().int().min(1).max(5).optional(),
});
export type SearchEateriesBody = z.infer<typeof SearchEateriesBodySchema>;
