/**
 * Fastify `onSend` hook that attaches RFC 8594 `Sunset` + the draft
 * `Deprecation` HTTP header + a `Link rel="deprecation"` to every
 * response served from a route listed in `DEPRECATED_ROUTES`.
 *
 * Header shape (per [ADR-016]):
 *
 *   Deprecation: true
 *   Sunset: <RFC 1123 date>
 *   Link: <changelog-url>; rel="deprecation"; type="text/html",
 *         <replacement-url>; rel="successor-version"
 *
 * The registry is empty today; the hook is wired into `main.ts`
 * regardless so adding the first entry to `DEPRECATED_ROUTES`
 * is the ONLY change needed to start emitting the headers.
 *
 * Installed by [F2].
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { DEPRECATED_ROUTES, type DeprecatedRoute } from './deprecated-routes';

/** Pre-index the registry by URL for O(1) lookup on every response. */
const BY_URL: ReadonlyMap<string, DeprecatedRoute> = new Map(
  DEPRECATED_ROUTES.map((entry) => [entry.url, entry] as const),
);

/** Convert ISO-8601 (`2026-11-23` or `2026-11-23T00:00:00Z`) to
 *  RFC 1123 (`Mon, 23 Nov 2026 00:00:00 GMT`) — the format RFC 8594
 *  mandates for the `Sunset` header. */
function toRfc1123(iso: string): string {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toUTCString() : iso;
}

function buildLinkHeader(entry: DeprecatedRoute): string {
  const parts = [`<${entry.changelogUrl}>; rel="deprecation"; type="text/html"`];
  if (entry.replacementUrl) parts.push(`<${entry.replacementUrl}>; rel="successor-version"`);
  return parts.join(', ');
}

export async function registerDeprecationHook(app: {
  getHttpAdapter(): { getInstance(): FastifyInstance };
}): Promise<void> {
  if (BY_URL.size === 0) {
    // Empty registry: register the hook anyway so the mechanism is
    // wired and exercised in tests. The hook short-circuits on the
    // first line of every response when no entries match.
  }
  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onSend', async (req: FastifyRequest, reply: FastifyReply, payload) => {
    // `routeOptions.url` is the *matched* route template, e.g.
    // `/api/v1/trips/:id`, not the resolved URL with the actual id.
    // That matches how DEPRECATED_ROUTES.url is written.
    const url = req.routeOptions?.url;
    if (!url) return payload;
    const entry = BY_URL.get(url);
    if (!entry) return payload;

    reply.header('Deprecation', 'true');
    reply.header('Sunset', toRfc1123(entry.sunsetDate));
    reply.header('Link', buildLinkHeader(entry));
    return payload;
  });
}
