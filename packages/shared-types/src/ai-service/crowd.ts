/**
 * ai-service `/v1/crowd/predict` — Prophet/LightGBM crowd-density
 * predictor on satellite + popular-times features.
 *
 * Authored from `docs/services/ai-service/contract.md` §2.
 * Installed by prompt [A5].
 */
import { z } from 'zod';

export const CrowdDensity = z.enum(['empty', 'light', 'busy', 'packed']);
export type CrowdDensity = z.infer<typeof CrowdDensity>;

export const CrowdPredictRequest = z.object({
  placeId: z.string(),
  /** ISO-8601 timestamp the prediction is for. */
  timestamp: z.string().datetime(),
});
export type CrowdPredictRequest = z.infer<typeof CrowdPredictRequest>;

export const CrowdPredictFeatures = z.object({
  dayOfWeek: z.number(),
  hourOfDay: z.number(),
  isHoliday: z.boolean(),
});
export type CrowdPredictFeatures = z.infer<typeof CrowdPredictFeatures>;

export const CrowdPredictResponse = z.object({
  density: CrowdDensity,
  densityScore: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  features: CrowdPredictFeatures,
});
export type CrowdPredictResponse = z.infer<typeof CrowdPredictResponse>;
