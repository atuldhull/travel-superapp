import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';

/**
 * Custom tracker that keys rate-limit buckets by **user id when
 * authenticated, else remote IP**.
 *
 * Every @nestjs/throttler bucket ends up keyed:
 *   `travel-<env>:throttle:<throttlerName>:<sha256(pepper + tracker)>`
 *
 * so per-IP, per-user, and per-endpoint-class dimensions all compose
 * automatically when a request hits a decorated route. The peppered
 * hash lives in `RedisThrottlerStorage` — this class returns the raw
 * tracker; the storage hashes it before it touches Redis.
 *
 * Installed by prompt [III.11.4].
 */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const fastifyReq = req as unknown as FastifyRequest & {
      user?: { id?: string | null } | null;
    };
    const userId = fastifyReq.user?.id ?? null;
    if (userId) return `user:${userId}`;
    const ip = fastifyReq.ip ?? 'unknown';
    return `ip:${ip}`;
  }
}
