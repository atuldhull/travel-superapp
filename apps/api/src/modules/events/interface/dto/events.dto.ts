/**
 * Zod schema for `POST /events/search`. ISO-8601 datetime strings on
 * the wire; use-case parses + validates ordering.
 *
 * Installed by prompt [IV.18.9.1].
 */
import { z } from 'zod';

const Coord = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const IsoDatetime = z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
  message: 'invalid ISO-8601 datetime',
});

export const SearchEventsBodySchema = z.object({
  center: Coord,
  // Use-case's INVALID_RADIUS wins above 30 — keep Zod loose.
  radiusKm: z.number().positive().max(10_000),
  from: IsoDatetime,
  to: IsoDatetime,
  category: z.string().trim().min(1).max(40).optional(),
  /** V.UX.16 — budget-backpacker free-events filter. */
  freeOnly: z.boolean().optional(),
});
export type SearchEventsBody = z.infer<typeof SearchEventsBodySchema>;

/**
 * V.UX.22 — `GET /events/festivals` query coercion. Centre is split
 * into `lat` / `lng` query params; `radiusKm` defaults to 30 (the
 * use-case cap). Use-case validates ordering + window length.
 */
export const FestivalsDuringQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().positive().max(10_000).optional(),
  from: IsoDatetime,
  to: IsoDatetime,
});
export type FestivalsDuringQuery = z.infer<typeof FestivalsDuringQuerySchema>;
