/**
 * Zod schemas for the Trip HTTP surface. Separate from the domain
 * DTO so the wire shape can evolve independently.
 *
 * Installed by prompt [IV.18.2.3].
 */
import { z } from 'zod';

const Coord = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** ISO-8601 datetime (accepts both date-only `2026-08-01` and full
 *  datetime `2026-08-01T00:00:00Z`). */
const IsoDateString = z
  .string()
  .refine((s) => !Number.isNaN(new Date(s).getTime()), { message: 'invalid ISO date' });

export const CreateTripBodySchema = z.object({
  title: z.string().trim().min(1).max(120),
  center: Coord,
  // Use-case double-enforces the 0 < x ≤ 500 invariant; keep the Zod
  // check loose enough that the use-case's typed error wins on 501+.
  radiusKm: z.number().positive().max(10_000),
  startsOn: IsoDateString.optional(),
  endsOn: IsoDateString.optional(),
});
export type CreateTripBody = z.infer<typeof CreateTripBodySchema>;
