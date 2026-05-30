/**
 * AE218 — pure URL builder for trip share + read-only view links.
 *
 * The journey dashboard's share mutation built the URL inline with
 * `window.location.origin` + `/shared/<code>`. /me/shares does the
 * same. Pulse's save+share combo does the same. This helper
 * canonicalises:
 *
 *   buildShareUrl({ origin, code, surface? }) → string
 *
 * `surface` is the path namespace — defaults to '/shared/<code>'
 * (the legacy public share path); passing 'aether' returns the
 * Aether-styled '/aether/shared/<code>' surface.
 *
 * Pure: takes the origin as an arg so callers decide whether to
 * pull it from window or NEXT_PUBLIC_SITE_URL (server contexts).
 * No throws — invalid input degenerates to a sensible default.
 */

export type ShareSurface = 'aether' | 'legacy';

export interface BuildShareUrlInputs {
  readonly origin: string;
  readonly code: string;
  readonly surface?: ShareSurface;
}

function trimTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

function pathFor(surface: ShareSurface): string {
  return surface === 'aether' ? '/aether/shared' : '/shared';
}

export function buildShareUrl(inputs: BuildShareUrlInputs): string {
  if (inputs.code === '') return '';
  const origin = trimTrailingSlash(inputs.origin);
  const path = pathFor(inputs.surface ?? 'legacy');
  return `${origin}${path}/${encodeURIComponent(inputs.code)}`;
}
