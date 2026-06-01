/**
 * AE390 — Continuum bar state encode / decode.
 *
 * Per docs/aether/02-surfaces.md §10 the Continuum bar is the cross-device
 * handoff: another device opens the encoded state and the surface resumes
 * with the same pathname + extras (focus / scroll / camera). Phase 4 wires
 * real WebTransport state-sync; Phase 1 ships the deep-link fallback that
 * the architecture doc explicitly calls out ("QR with deep-link fallback").
 *
 * Everything here is pure — no `window`, no React, no QR rendering. The
 * helpers project a `ContinuumState` into a URL the receiving device can
 * paste/scan, and parse such a URL back. The visual sigil that goes
 * alongside the URL lives in `./continuum-sigil.ts`.
 */

/** Opaque-by-convention key/value pairs the continuing surface understands.
 *
 *  Values are strings so the encoding round-trips cleanly through URL
 *  search params (no JSON-stringify ambiguity). Surfaces define their own
 *  extras: Atlas might pass `focus=<slug>`, Drift might pass `next=<id>`,
 *  Compass might pass `bearing=<deg>`. Unknown extras flow through both
 *  directions untouched so a forward-rolled receiver still gets them. */
export type ContinuumExtras = Readonly<Record<string, string>>;

/** Everything a receiving device needs to resume where the sender was. */
export interface ContinuumState {
  /** Pathname (no origin, no search). Must start with '/'. */
  readonly pathname: string;
  /** Optional surface-specific payload. */
  readonly extras?: ContinuumExtras;
}

/** Continuum query param name. Lives on the receiving URL as
 *  `?aether-continuum=1` so the receiving page can detect "I was opened
 *  by a handoff" vs a normal visit (e.g. show a `Continue here?` prompt). */
export const CONTINUUM_QUERY_KEY = 'aether-continuum';

/** Build the deep-link URL the sender shows in the Continuum popover and
 *  the receiver opens.
 *
 *  - `state.pathname` becomes the URL pathname (trailing slash trimmed).
 *  - Each `state.extras[k]` becomes a search param `k=v`, URI-encoded.
 *  - The marker `aether-continuum=1` is appended last so receivers can
 *    distinguish a continuation from a fresh visit.
 *
 *  Origin: pass an explicit origin (production scenarios will use the
 *  user-visible URL); in jsdom/SSR the caller defers via `''` and the
 *  result is a relative URL. */
export function buildContinuumUrl(state: ContinuumState, origin = ''): string {
  const pathname = normalisePathname(state.pathname);
  const params = new URLSearchParams();
  if (state.extras !== undefined) {
    // Iterate in insertion order so output is deterministic per a given
    // extras object — important for the sigil hash to be stable.
    for (const [k, v] of Object.entries(state.extras)) {
      if (k === CONTINUUM_QUERY_KEY) continue; // never override marker
      params.set(k, v);
    }
  }
  params.set(CONTINUUM_QUERY_KEY, '1');
  const search = params.toString();
  const tail = search === '' ? '' : `?${search}`;
  if (origin === '') return `${pathname}${tail}`;
  return `${trimTrailingSlash(origin)}${pathname}${tail}`;
}

/** Parse a Continuum URL back into a state. Tolerates absent marker (so
 *  the helpers can be reused for non-Continuum URL shapes) and ignores
 *  query params that don't decode cleanly. */
export function parseContinuumUrl(input: string): ContinuumState | null {
  if (typeof input !== 'string' || input === '') return null;
  let pathname: string;
  let search: URLSearchParams;
  try {
    // URL needs an origin to parse relative inputs — use a sentinel
    // that won't collide with real hosts; we drop it before returning.
    const u = new URL(input, 'http://aether.invalid/');
    pathname = u.pathname;
    search = u.searchParams;
  } catch {
    return null;
  }
  const extras: Record<string, string> = {};
  for (const [k, v] of search.entries()) {
    if (k === CONTINUUM_QUERY_KEY) continue;
    extras[k] = v;
  }
  const hasExtras = Object.keys(extras).length > 0;
  return {
    pathname: normalisePathname(pathname),
    ...(hasExtras ? { extras } : {}),
  };
}

/** True when this URL carries the Continuum marker. The receiver uses
 *  this to gate the "Continue here?" UI vs treating the load as a normal
 *  visit (e.g. a bookmark or a typed-in URL). */
export function isContinuumUrl(input: string): boolean {
  if (typeof input !== 'string' || input === '') return false;
  try {
    const u = new URL(input, 'http://aether.invalid/');
    return u.searchParams.get(CONTINUUM_QUERY_KEY) === '1';
  } catch {
    return false;
  }
}

/** Stable hash seed for the visual sigil: the canonical URL string
 *  (sans origin) so the sigil is identity-shared across devices that
 *  resolve the same handoff. */
export function continuumSigilSeed(state: ContinuumState): string {
  return buildContinuumUrl(state, '');
}

/** Internal — leading slash enforced; trailing slash stripped (except
 *  the root). Empty / non-string inputs collapse to '/'. */
function normalisePathname(p: string): string {
  if (typeof p !== 'string' || p === '') return '/';
  const withLeading = p.startsWith('/') ? p : `/${p}`;
  return trimTrailingSlash(withLeading);
}

function trimTrailingSlash(p: string): string {
  if (p.length > 1 && p.endsWith('/')) return p.slice(0, -1);
  return p;
}
