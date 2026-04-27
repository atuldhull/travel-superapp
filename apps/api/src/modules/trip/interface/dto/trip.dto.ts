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

/**
 * Body for `POST /trips/sample-plan`. Public-facing landing-page
 * demo; tighter caps than CreateTripBodySchema since this never
 * persists a row.
 */
export const GenerateSamplePlanBodySchema = z.object({
  title: z.string().trim().min(1).max(120),
  center: Coord,
  radiusKm: z.number().positive().max(200),
});
export type GenerateSamplePlanBody = z.infer<typeof GenerateSamplePlanBodySchema>;

/**
 * PATCH /trips/:id body. Every field optional. `startsOn` / `endsOn`
 * also accept `null` so the client can clear a previously-set date.
 * No `center` — trip location changes are delete + re-create.
 */
/**
 * Body for PATCH /trips/:tripId/itinerary/:dayId. Replaces the
 * full item list for a day. Empty array wipes the day clean.
 * Position is integer ≥ 1; `placeId` is either a non-empty string
 * (resolved in the use-case against the Place table) or explicitly
 * null for a free-form activity that doesn't reference a Place row.
 */
export const UpdateDayItemsBodySchema = z.object({
  items: z
    .array(
      z.object({
        position: z.number().int().positive(),
        placeId: z.union([z.string().min(1), z.null()]).optional(),
        notes: z.string().trim().max(500).nullable().optional(),
      }),
    )
    .max(20),
});
export type UpdateDayItemsBody = z.infer<typeof UpdateDayItemsBodySchema>;

export const UpdateTripBodySchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    radiusKm: z.number().positive().max(10_000).optional(),
    startsOn: z.union([IsoDateString, z.null()]).optional(),
    endsOn: z.union([IsoDateString, z.null()]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'patch body must have at least one field',
    path: ['(root)'],
  });
export type UpdateTripBody = z.infer<typeof UpdateTripBodySchema>;

/**
 * Body for POST /trips/:id/share. Caller can set an optional expiry;
 * use-case rejects past dates with a typed `INVALID_EXPIRY` error.
 */
export const CreateTripShareBodySchema = z
  .object({
    expiresAt: IsoDateString.optional(),
  })
  .strict();
export type CreateTripShareBody = z.infer<typeof CreateTripShareBodySchema>;

/**
 * Body for `POST /trips/:id/place-suggestions`. Optional category
 * filter narrows results to a single place type ("museum",
 * "cafe", etc.). Empty body == "anything within range".
 */
export const SuggestPlacesForTripBodySchema = z
  .object({
    category: z.string().trim().min(1).max(60).optional(),
  })
  .strict();
export type SuggestPlacesForTripBody = z.infer<typeof SuggestPlacesForTripBodySchema>;
