/**
 * AE331 — pure side-effect helper for the AE96 'aether-pulse-open'
 * CustomEvent bridge. Replaces an SSR-guard + dispatchEvent inlined
 * across three surfaces (destination, journal, me-home).
 *
 * Returns true if the dispatch happened, false in SSR. Keeping the
 * boolean lets consumers unit-test "did we try?" without intercepting
 * the global. The `detail.submit` flag is forwarded to the existing
 * AE163 `decodePulseOpenEvent` reader (when true + prefill non-empty,
 * Pulse auto-sends).
 */

export interface OpenPulseOptions {
  readonly submit?: boolean;
}

export function openPulse(prefill: string, options: OpenPulseOptions = {}): boolean {
  if (typeof window === 'undefined') return false;
  const detail: { prefill: string; submit?: boolean } = { prefill };
  if (options.submit === true) detail.submit = true;
  window.dispatchEvent(new CustomEvent('aether-pulse-open', { detail }));
  return true;
}
