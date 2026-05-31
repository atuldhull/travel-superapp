/**
 * Route → Surface matching.
 *
 * Given a pathname (`/aether/journey/abc123`), find the route-bound Surface
 * that should mount, plus the list of overlay Surfaces that always render
 * alongside it.
 *
 * Pure; no React. The provider in `manager.tsx` calls these in a `useMemo`
 * whenever the URL changes.
 *
 * Phase 1 routing (04-sequencing.md):
 *   drift          → '/aether'  (and '/aether/drift' once the rebuild lands)
 *   atlas          → '/aether/journey/:id'
 *   compass        → '/aether/atlas'  (Bird mode; AR Eye lands Phase 3)
 *   pulse          → overlay
 *   continuum      → overlay
 */
import type { Surface, SurfaceRouteMatch } from './types';

/** Does this route match the given pathname?
 *
 *  Literal: exact match. Pattern: `:segment` placeholders consume one path
 *  segment each. Predicate: caller-supplied. Overlay: never matches a
 *  route — overlays are surfaced separately via `overlaySurfaces`. */
export function matchSurfaceRoute(match: SurfaceRouteMatch, pathname: string): boolean {
  switch (match.kind) {
    case 'literal':
      return match.pathname === pathname;
    case 'pattern':
      return matchPattern(match.pathname, pathname);
    case 'predicate':
      return match.match(pathname);
    case 'overlay':
      return false;
  }
}

/** The route-bound Surface for this pathname, or undefined if none match.
 *
 *  Surfaces are tried in registration order; the first match wins. Overlay
 *  Surfaces are never returned here — query `overlaySurfaces()` separately. */
export function routeToSurface(
  pathname: string,
  surfaces: ReadonlyArray<Surface>,
): Surface | undefined {
  for (const s of surfaces) {
    if (s.route.kind === 'overlay') continue;
    if (matchSurfaceRoute(s.route, pathname)) return s;
  }
  return undefined;
}

/** All registered overlay Surfaces in registration order. */
export function overlaySurfaces(surfaces: ReadonlyArray<Surface>): ReadonlyArray<Surface> {
  return surfaces.filter((s) => s.route.kind === 'overlay');
}

/** Internal — pattern matcher. Splits on `/`; `:placeholder` segments
 *  match any one non-empty segment. Trailing slashes are stripped.
 *
 *  Examples (pattern, pathname, expected):
 *    '/aether/journey/:id'   '/aether/journey/abc'        → true
 *    '/aether/journey/:id'   '/aether/journey/abc/extra'  → false
 *    '/aether/journey/:id'   '/aether/journey/'           → false
 *    '/aether'               '/aether'                    → true
 */
function matchPattern(pattern: string, pathname: string): boolean {
  const a = trimTrail(pattern).split('/');
  const b = trimTrail(pathname).split('/');
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const tok = a[i] ?? '';
    const seg = b[i] ?? '';
    if (tok.startsWith(':')) {
      if (seg === '') return false;
      continue;
    }
    if (tok !== seg) return false;
  }
  return true;
}

function trimTrail(p: string): string {
  if (p.length > 1 && p.endsWith('/')) return p.slice(0, -1);
  return p;
}
