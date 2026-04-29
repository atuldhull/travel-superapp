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

/**
 * V.UX.20 — foodie persona: dish report on an eatery. Use-case
 * enforces the priceUsd numeric range; Zod just keeps the shape
 * sane (positive, reasonable cap on string lengths).
 */
export const AddDishReportBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  priceUsd: z.number().positive().max(10_000).optional(),
  photoUrl: z.string().trim().min(1).max(1024).optional(),
  caption: z.string().trim().min(1).max(280).optional(),
});
export type AddDishReportBody = z.infer<typeof AddDishReportBodySchema>;

/**
 * V.UX.20 — food crawl builder. Use-case caps stops at 2..5 and
 * 404s on missing eateries; Zod keeps the array length sane.
 */
export const BuildFoodCrawlBodySchema = z.object({
  eateryIds: z.array(z.string().trim().min(1).max(64)).min(2).max(5),
});
export type BuildFoodCrawlBody = z.infer<typeof BuildFoodCrawlBodySchema>;
