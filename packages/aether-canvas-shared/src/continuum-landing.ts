/**
 * AE391 — Continuum receiver landing detection (pure).
 *
 * The sender side (AE390) writes `?aether-continuum=1` plus any
 * surface-specific extras into the URL. AE391's receiver side reads
 * the search params and decides whether to surface a "Continued from
 * another device" affordance.
 *
 * Everything here is pure — no React, no `window`. The hook in
 * `use-continuum-landing.tsx` wires Next's `useSearchParams()` into
 * `readContinuumLanding(...)` so the helpers stay framework-agnostic.
 */
import { CONTINUUM_QUERY_KEY, type ContinuumExtras } from './continuum-state';

/** Resolved landing state — what the toast / receiver chrome reads. */
export interface ContinuumLanding {
  /** True when the marker query param was present and === '1'. */
  readonly isHandoff: boolean;
  /** Extras restored from the URL (sans the marker). Empty object
   *  when no extras were attached. */
  readonly extras: ContinuumExtras;
}

/** The empty landing state — returned when nothing was handed off. */
export const NO_CONTINUUM_LANDING: ContinuumLanding = Object.freeze({
  isHandoff: false,
  extras: Object.freeze({}),
});

/** Parse a URLSearchParams-like object into a landing state.
 *
 *  Accepts a real `URLSearchParams`, a `ReadonlyURLSearchParams` (Next's
 *  variant from `useSearchParams()`), or a plain `Record<string, string>`
 *  / `Record<string, string | string[]>` shape so tests + edge cases
 *  (`null` from `useSearchParams()` during SSR) can short-circuit. */
export function readContinuumLanding(
  params:
    | URLSearchParams
    | { get(key: string): string | null; entries(): IterableIterator<[string, string]> }
    | Readonly<Record<string, string | string[] | undefined>>
    | null
    | undefined,
): ContinuumLanding {
  if (params === null || params === undefined) return NO_CONTINUUM_LANDING;
  // URLSearchParams + ReadonlyURLSearchParams (Next) both expose .get + .entries.
  if (typeof (params as URLSearchParams).get === 'function') {
    const p = params as URLSearchParams;
    if (p.get(CONTINUUM_QUERY_KEY) !== '1') return NO_CONTINUUM_LANDING;
    const extras: Record<string, string> = {};
    // `URLSearchParams.entries()` is missing from RN's TS lib in some
    // setups; `forEach` is universally available across web + RN.
    p.forEach((v, k) => {
      if (k === CONTINUUM_QUERY_KEY) return;
      extras[k] = v;
    });
    return { isHandoff: true, extras };
  }
  // Plain object — treat string[] as "take the first value" so URL.parse-style
  // shapes still flow through.
  const obj = params as Readonly<Record<string, string | string[] | undefined>>;
  const marker = obj[CONTINUUM_QUERY_KEY];
  const markerValue = Array.isArray(marker) ? marker[0] : marker;
  if (markerValue !== '1') return NO_CONTINUUM_LANDING;
  const extras: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === CONTINUUM_QUERY_KEY) continue;
    if (v === undefined) continue;
    extras[k] = Array.isArray(v) ? (v[0] ?? '') : v;
  }
  return { isHandoff: true, extras };
}

/** Format a friendly one-line message for the receiver toast.
 *
 *  The message reads as a small editorial summary of what was carried,
 *  not a list of raw extras. Phase 1 understands a small vocabulary
 *  — extras outside it just contribute a generic "with N hint(s)"
 *  trailer so a forward-rolled sender's extras don't get dropped on
 *  the floor visibly.
 *
 *  Known keys (Phase 1):
 *    trip   → "Trip restored"
 *    focus  → "Focused on <slug>"
 *    bearing→ "Bearing <deg>°"
 */
export function formatContinuumLandingMessage(extras: ContinuumExtras): string {
  const head = 'Continued from another device';
  const knownKeys: ReadonlyArray<string> = ['trip', 'focus', 'bearing'];
  const knownParts: string[] = [];
  let unknownCount = 0;
  for (const [k, v] of Object.entries(extras)) {
    if (k === 'trip') {
      knownParts.push('trip restored');
      continue;
    }
    if (k === 'focus') {
      knownParts.push(`focused on ${v}`);
      continue;
    }
    if (k === 'bearing') {
      knownParts.push(`bearing ${v}°`);
      continue;
    }
    if (knownKeys.includes(k)) continue;
    unknownCount += 1;
  }
  if (unknownCount > 0) {
    knownParts.push(`with ${unknownCount} hint${unknownCount === 1 ? '' : 's'}`);
  }
  if (knownParts.length === 0) return head;
  return `${head} · ${knownParts.join(' · ')}`;
}
