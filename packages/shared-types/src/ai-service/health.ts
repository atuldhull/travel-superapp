/**
 * ai-service `/v1/health` — liveness probe consumed by `apps/api`'s
 * `/health/ready` aggregator once the service is wired
 * (`FEATURE_AI_SERVICE_HEALTH_CHECK`).
 *
 * Authored from `docs/services/ai-service/contract.md` §2.
 * Installed by prompt [A5].
 */
import { z } from 'zod';

export const AiServiceHealthResponse = z.object({
  status: z.literal('ok'),
  ray: z.object({
    replicas: z.number().int().nonnegative(),
    healthy: z.number().int().nonnegative(),
  }),
});
export type AiServiceHealthResponse = z.infer<typeof AiServiceHealthResponse>;
