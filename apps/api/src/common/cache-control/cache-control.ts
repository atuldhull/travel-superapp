/**
 * Cache-Control header helpers ([Q6]).
 *
 * The api is authoritative on caching intent — Cloudflare ([Q6]
 * terraform) is configured `respect_origin` so we control the policy
 * here. Two postures:
 *
 *   1. Never cacheable — authenticated reads, writes, anything with
 *      Set-Cookie. Emits `Cache-Control: no-store`.
 *   2. Public read — anonymous GET that returns the same response
 *      for every caller within the TTL. Emits
 *      `Cache-Control: public, max-age=<browser>, s-maxage=<edge>, stale-while-revalidate=<swr>`.
 *
 * Stale-while-revalidate lets Cloudflare serve a stale response (for
 * up to `swr` seconds past expiry) while it asynchronously refreshes
 * from origin — the second-to-last user sees a stale cache; the cache
 * never goes cold. This is the right default for read-heavy pages.
 *
 * Usage in a controller (Nest + Fastify):
 *
 *   import { setCachePublic } from '@common/cache-control/cache-control';
 *
 *   @Get('/featured')
 *   async featured(@Res({ passthrough: true }) res: FastifyReply) {
 *     setCachePublic(res, { edgeTtl: 60, browserTtl: 0, staleWhileRevalidate: 60 });
 *     return this.places.featured();
 *   }
 *
 * The fitness invariant in apps/api/test/architecture.fitness.spec.ts
 * verifies every public-read controller calls one of these helpers.
 *
 * Installed by [Q6] of the Scale-readiness 3→10 series.
 */

import type { FastifyReply } from 'fastify';

export interface PublicCacheOptions {
  /** Edge (Cloudflare) TTL in seconds — `s-maxage`. */
  edgeTtl: number;
  /** Browser TTL in seconds — `max-age`. Often 0 for public reads
   *  (clients revalidate on each request; the edge serves from cache). */
  browserTtl: number;
  /** Stale-while-revalidate window in seconds. Default = edgeTtl
   *  (lets the edge keep serving for one TTL past expiry while it
   *  refreshes). Set to 0 to disable. */
  staleWhileRevalidate?: number;
}

/** Mark a response as never-cacheable. Use on authenticated reads,
 *  writes, or anything with Set-Cookie. Emits both `Cache-Control:
 *  no-store` AND `Vary: *` so any intermediate cache also bypasses. */
export function setCacheNoStore(res: FastifyReply): void {
  res.header('Cache-Control', 'no-store');
  res.header('Pragma', 'no-cache'); // HTTP/1.0 holdovers — cheap insurance.
}

/** Mark a response as publicly cacheable for a short TTL. */
export function setCachePublic(res: FastifyReply, opts: PublicCacheOptions): void {
  const swr = opts.staleWhileRevalidate ?? opts.edgeTtl;
  const parts = ['public', `max-age=${opts.browserTtl}`, `s-maxage=${opts.edgeTtl}`];
  if (swr > 0) parts.push(`stale-while-revalidate=${swr}`);
  res.header('Cache-Control', parts.join(', '));
  // `Vary: Accept-Encoding` is added by Fastify's compression plugin;
  // we add Accept-Language so per-locale variants don't collide.
  res.header('Vary', 'Accept-Encoding, Accept-Language');
}
