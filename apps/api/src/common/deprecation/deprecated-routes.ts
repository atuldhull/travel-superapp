/**
 * Registry of deprecated API routes — the data side of the [F2]
 * RFC 8594 deprecation mechanism. Routes listed here have a
 * `Deprecation: true` + `Sunset: <date>` + `Link rel="deprecation"`
 * header bag attached to every response by
 * `register-deprecation-hook.ts`.
 *
 * Policy (per [ADR-016]):
 *   - A route lands here ONLY when a `/api/v2` replacement is live.
 *   - `sunsetDate` is the earliest day the v1 route MAY return 410.
 *     ADR-016 mandates a 6-month minimum window from the day the
 *     route was added here. The fitness spec
 *     `deprecated-routes.fitness.spec.ts` enforces this.
 *   - `replacementUrl` is the v2 equivalent (path-prefixed) so the
 *     SDK can surface a migration hint to the developer console.
 *   - `changelogUrl` points at the public changelog entry that
 *     explains what changed and how to migrate.
 *
 * The registry is intentionally EMPTY today — the mechanism is in
 * place, no v1 routes have been superseded yet. The first entry
 * lands together with the first `/api/v2` controller per the
 * ADR-016 ADR-mandatory-per-bump rule.
 *
 * Installed by [F2] — making the ADR-016 policy mechanical.
 */

/** One deprecated-route entry. Routes match by EXACT URL (no
 *  pattern matching today — when the first entry uses a `:param`
 *  segment, extend the matcher in `register-deprecation-hook.ts`
 *  rather than encoding the pattern shape in this type). */
export interface DeprecatedRoute {
  /**
   * Exact request URL the hook compares against. Fastify exposes
   * the matched route as `req.routeOptions.url`; that's what gets
   * compared, so use the same template form (`/api/v1/foo/:id`).
   */
  readonly url: string;
  /**
   * ISO-8601 date the route may return `410 Gone`. The fitness
   * spec asserts this is at least 6 months past the registry-entry
   * commit date (read from `git log -1` on this file).
   */
  readonly sunsetDate: string;
  /** v2 path replacing this route, for the `replacementUrl` hint. */
  readonly replacementUrl: string;
  /** Public-facing changelog entry for the deprecation. */
  readonly changelogUrl: string;
}

/**
 * The registry. Empty today; first entry ships with /api/v2.
 *
 * Append-only by convention — REMOVING an entry means the route
 * has been deleted (post-Sunset), not "no longer deprecated".
 */
export const DEPRECATED_ROUTES: readonly DeprecatedRoute[] = [];
