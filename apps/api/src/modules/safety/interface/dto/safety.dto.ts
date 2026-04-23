/**
 * Zod schemas for the Safety endpoints.
 *
 * Installed by prompt [IV.18.11.1].
 */
import { z } from 'zod';

const Coord = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const ScamSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const ReportScamBodySchema = z.object({
  center: Coord,
  // Free-form — a future slice can tighten to an enum once the
  // category catalog stabilizes. 60 chars accommodates compound
  // labels like `overcharge-at-tourist-attraction`.
  category: z.string().trim().min(1).max(60),
  severity: ScamSeveritySchema,
  description: z.string().trim().min(10).max(2000),
  evidenceUrls: z.array(z.string().url().max(500)).max(5).optional(),
});
export type ReportScamBody = z.infer<typeof ReportScamBodySchema>;

export const FindNearbyScamsBodySchema = z.object({
  center: Coord,
  // Use-case's INVALID_RADIUS wins above 50km — keep Zod loose so
  // the typed error surfaces instead of VALIDATION_FAILED.
  radiusKm: z.number().positive().max(10_000),
  category: z.string().trim().min(1).max(60).optional(),
  minSeverity: ScamSeveritySchema.optional(),
  limit: z.number().int().positive().max(200).optional(),
});
export type FindNearbyScamsBody = z.infer<typeof FindNearbyScamsBodySchema>;
