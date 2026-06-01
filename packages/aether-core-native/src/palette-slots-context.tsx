/**
 * `SurfacePaletteSlotsContext` — React Context replacement for the
 * web's `<SurfacePaletteVars>` CSS custom properties.
 *
 * AE514. Native has no global document root + no CSS custom property
 * system, so the same five palette slots (ink / surface / accent /
 * glow / support) ride a React Context instead. Mount
 * `<SurfacePaletteSlotsProvider>` once high in the tree (below the
 * `<SurfaceManagerProvider>`) and every descendant can read
 * `useSurfacePaletteSlotsFromContext()` to get the resolved slots —
 * with the same `<SurfacePaletteOverride>` precedence as web, since
 * the provider reads `useSurfacePalette()` internally.
 *
 * Why a separate context (vs just calling `useSurfacePaletteSlots()`
 * everywhere): the slots-context lets pure render-only components
 * (e.g. a deep-tree Skia component that wants the accent colour) read
 * the slots WITHOUT subscribing to surface-manager re-renders. The
 * provider does the work once; descendants read a stable Context.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useSurfacePaletteSlots, type SurfacePaletteSlots } from '@app/aether-core';

/** Context value — the resolved palette slots, or `null` when no
 *  provider sits above the consumer. Consumers MUST handle the null
 *  case so a missing provider degrades gracefully. */
export type SurfacePaletteSlotsContextValue = SurfacePaletteSlots | null;

export const SurfacePaletteSlotsContext = createContext<SurfacePaletteSlotsContextValue>(null);

SurfacePaletteSlotsContext.displayName = 'SurfacePaletteSlotsContext';

export interface SurfacePaletteSlotsProviderProps {
  children: ReactNode;
}

/**
 * Mirror `useSurfacePaletteSlots()` into the Context so deep consumers
 * read it without subscribing to the manager. Must sit beneath
 * `<SurfaceManagerProvider>` because it calls `useSurfacePaletteSlots`
 * internally.
 */
export function SurfacePaletteSlotsProvider({
  children,
}: SurfacePaletteSlotsProviderProps): React.ReactElement {
  const slots = useSurfacePaletteSlots();
  // useMemo isn't strictly necessary since slots is a stable object
  // reference from the upstream hook, but it makes the contract
  // explicit for consumers reading this in isolation.
  const value = useMemo<SurfacePaletteSlotsContextValue>(() => slots, [slots]);
  return (
    <SurfacePaletteSlotsContext.Provider value={value}>
      {children}
    </SurfacePaletteSlotsContext.Provider>
  );
}

/**
 * Read the resolved palette slots from Context. Returns `null` when
 * no `<SurfacePaletteSlotsProvider>` sits above the consumer — caller
 * is expected to coalesce with a fallback (typically the default
 * Warm Italian slots or the consumer's own theme).
 */
export function useSurfacePaletteSlotsFromContext(): SurfacePaletteSlotsContextValue {
  return useContext(SurfacePaletteSlotsContext);
}
