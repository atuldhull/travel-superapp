/**
 * Zod schema for `POST /transport/navigation`. Shares the `Coord`
 * primitive shape used across Places / Trip / Stays bodies. Optional
 * `waypoints` are intermediate stops in visiting order.
 *
 * Installed for the live-navigation feature.
 */
import { z } from 'zod';

const Coord = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const GetNavigationBodySchema = z.object({
  origin: Coord,
  destination: Coord,
  waypoints: z.array(Coord).max(8).optional(),
});
export type GetNavigationBody = z.infer<typeof GetNavigationBodySchema>;
