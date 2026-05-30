/**
 * AE254 — SSR-safe deterministic id generator.
 *
 * For component-local DOM ids (aria-labelledby, listbox option ids)
 * React 18 has useId, but it produces ids with ':' which jsdom +
 * older Safari don't accept as CSS selectors. This hook wraps
 * useId with a CSS-safe normalisation + an optional prefix:
 *
 *   const id = useStableId('atlas-row');  // -> 'atlas-row-r3'
 *
 * Same id across SSR and CSR (uses useId), CSS-selector-safe,
 * accepts an optional prefix for debuggability.
 */
import { useId } from 'react';

export function useStableId(prefix: string = 'a'): string {
  const raw = useId();
  // React 18 useId returns ':r0:' / ':r1:' / etc. Strip colons.
  const safe = raw.replace(/:/g, '');
  return `${prefix}-${safe}`;
}
