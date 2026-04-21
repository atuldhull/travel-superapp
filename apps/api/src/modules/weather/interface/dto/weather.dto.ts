/**
 * Zod schema for `GET /weather/forecast` query params. Keep loose
 * enough that typed domain errors (`INVALID_COORDINATES`) win over
 * the generic `VALIDATION_FAILED` on edge cases — the use-case
 * owns the final say.
 *
 * Installed by prompt [IV.18.5.1].
 */
import { z } from 'zod';

// `@Query()` delivers everything as strings, so coerce up front.
export const WeatherForecastQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  // Use-case clamps to [1, 16]. Zod keeps it a positive int + bounded
  // upper value so obviously-bad inputs (e.g. `days=1000000`) fail
  // fast at validation.
  days: z.coerce.number().int().positive().max(100).optional(),
});
export type WeatherForecastQuery = z.infer<typeof WeatherForecastQuerySchema>;
