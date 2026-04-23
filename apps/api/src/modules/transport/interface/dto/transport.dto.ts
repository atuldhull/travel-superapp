/**
 * Zod schema for `POST /transport/routes`. Origin + destination as
 * nested coord objects so clients can share the Coord primitive they
 * already use for Places + Trip + Stays search bodies.
 *
 * `modes` is an optional array of enum strings matching
 * `TransportMode`. Empty array treated as "no filter" (same as
 * undefined).
 *
 * Installed by prompt [IV.18.10.1].
 */
import { z } from 'zod';

const Coord = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const TransportModeSchema = z.enum([
  'walk',
  'public_transit',
  'bicycle',
  'two_wheeler',
  'car',
  'taxi',
  'rideshare',
]);

export const GetRoutesBodySchema = z.object({
  origin: Coord,
  destination: Coord,
  modes: z.array(TransportModeSchema).max(7).optional(),
});
export type GetRoutesBody = z.infer<typeof GetRoutesBodySchema>;
