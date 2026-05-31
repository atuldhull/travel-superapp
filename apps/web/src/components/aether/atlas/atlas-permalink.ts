/**
 * AE358 / AE359 — Atlas permalink encode/decode kit.
 *
 * Atlas state worth serializing into the URL:
 *   • `q` — the text filter (raw user input, trimmed)
 *   • `season` — the "in season only" toggle ("1" or absent)
 *   • `focus` — the slug of a pin to spotlight (used by the Atlas list
 *     to scroll-into-view + pre-select on load)
 *
 * Encoding rules (all values are LOSSY-safe — i.e. round-tripping
 * survives bad inputs by reverting to defaults):
 *   - empty `q` → omit
 *   - `season=false` → omit (default is off, no need to bloat URL)
 *   - empty/unknown `focus` slug → omit (caller decides if slug is
 *     known; this helper just shape-checks)
 *
 * Decoder accepts any `URLSearchParams`-shaped input (URLSearchParams
 * instance OR an object map) so server-side + client-side render
 * paths can both consume it.
 */

export interface AtlasParams {
  readonly q: string;
  readonly season: boolean;
  readonly focus: string | null;
}

export const DEFAULT_ATLAS_PARAMS: AtlasParams = {
  q: '',
  season: false,
  focus: null,
};

interface ParamsLike {
  get(key: string): string | null;
}

function isParamsLike(input: unknown): input is ParamsLike {
  return (
    input !== null &&
    typeof input === 'object' &&
    typeof (input as { get?: unknown }).get === 'function'
  );
}

function readField(
  input: URLSearchParams | Readonly<Record<string, string | null | undefined>> | null | undefined,
  key: string,
): string | null {
  if (input === null || input === undefined) return null;
  if (isParamsLike(input)) return input.get(key);
  const v = (input as Record<string, string | null | undefined>)[key];
  return typeof v === 'string' ? v : null;
}

/** Decode any URLSearchParams-shaped input into a sanitised AtlasParams. */
export function parseAtlasParams(
  input: URLSearchParams | Readonly<Record<string, string | null | undefined>> | null | undefined,
): AtlasParams {
  const rawQ = readField(input, 'q') ?? '';
  const rawSeason = readField(input, 'season');
  const rawFocus = readField(input, 'focus');
  // Trim + collapse runs of whitespace; cap length to defend against
  // pathological URL inputs (40k unicode chars would still pass URL
  // parsing, just kill perf downstream).
  const q = rawQ.replace(/\s+/g, ' ').trim().slice(0, 200);
  // Accept '1' / 'true' / 'on' — be lenient for the operator hand-
  // crafted URL case. Empty / anything else → false.
  const season = rawSeason === '1' || rawSeason === 'true' || rawSeason === 'on';
  // Slug shape gate: lowercase alphanum + dashes only; anything else
  // is treated as absent so the caller doesn't need to re-validate.
  const focusCandidate = rawFocus !== null ? rawFocus.trim().toLowerCase() : '';
  const focus = /^[a-z0-9][a-z0-9-]{0,63}$/.test(focusCandidate) ? focusCandidate : null;
  return { q, season, focus };
}

/** Encode AtlasParams back into a URL query string ('' or '?q=…&…').
 *  Skips defaulted fields so the URL stays clean. Returns the
 *  bare suffix (callers prepend the pathname). */
export function buildAtlasQuery(params: AtlasParams): string {
  const out = new URLSearchParams();
  if (params.q.trim() !== '') out.set('q', params.q.trim());
  if (params.season === true) out.set('season', '1');
  if (params.focus !== null && params.focus !== '') out.set('focus', params.focus);
  const s = out.toString();
  return s === '' ? '' : `?${s}`;
}

/** True when two AtlasParams produce identical URL output (used by
 *  the wire-in effect to skip redundant router.replace calls). */
export function atlasParamsEqual(a: AtlasParams, b: AtlasParams): boolean {
  return a.q.trim() === b.q.trim() && a.season === b.season && a.focus === b.focus;
}
