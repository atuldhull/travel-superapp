/**
 * `useSurfacePalette()` + `<SurfacePaletteVars>` — React layer for the
 * pure palette helpers in `./palette.ts`.
 *
 * The hook reads the current Surface from `useCurrentSurface()` (so it
 * must sit beneath a `<SurfaceManagerProvider>`) and resolves to that
 * Surface's palette via `paletteForSurface`. Components that need slot
 * names rather than indices can use `useSurfacePaletteSlots()`.
 *
 * `<SurfacePaletteVars>` is a side-effect-only component that mirrors the
 * resolved palette onto the document root as CSS custom properties
 * (`--aether-palette-{0..4}` and `--aether-palette-{ink,surface,accent,
 * glow,support}`) so non-R3F consumers (the Suspense placeholder, the
 * dev pip, future editorial cards inside a surface) can pick up the
 * current surface's accent without prop-drilling.
 */
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useCurrentSurface } from './manager';
import {
  DEFAULT_SURFACE_PALETTE,
  paletteForSurface,
  slotsFor,
  type SurfacePalette,
  type SurfacePaletteSlots,
} from './palette';

/**
 * Override context (AE384). When a `<SurfacePaletteOverride palette={...}>`
 * is mounted above a consumer of `useSurfacePalette()`, the override wins
 * over the registered Surface's palette. Use case: Atlas tints itself
 * from the active trip's destination slug instead of the registry-baked
 * "deeper earth" default.
 *
 * Setting the override to `null` means "no override — defer to the
 * Surface's own palette". Trees that don't mount the provider see the
 * AE381 behaviour unchanged.
 */
const SurfacePaletteOverrideContext = createContext<SurfacePalette | null>(null);

export interface SurfacePaletteOverrideProps {
  /** When set, replaces whatever `useSurfacePalette()` would otherwise
   *  return. Pass `null` for no override (defer to Surface). */
  palette: SurfacePalette | null;
  children: ReactNode;
}

/** Provider that swaps the active palette without touching the registered
 *  Surface. The Atlas shell mounts this with the trip-derived palette. */
export function SurfacePaletteOverride({
  palette,
  children,
}: SurfacePaletteOverrideProps): React.ReactElement {
  return (
    <SurfacePaletteOverrideContext.Provider value={palette}>
      {children}
    </SurfacePaletteOverrideContext.Provider>
  );
}

/** Resolved palette for the current Surface. AE384 prefers a non-null
 *  `<SurfacePaletteOverride>` value above the consumer; otherwise falls
 *  back to the AE381 behaviour: surface's own palette or
 *  `DEFAULT_SURFACE_PALETTE`. */
export function useSurfacePalette(): SurfacePalette {
  const override = useContext(SurfacePaletteOverrideContext);
  const current = useCurrentSurface();
  return useMemo(() => override ?? paletteForSurface(current), [override, current]);
}

/** Same as `useSurfacePalette()` but projected into named slots. */
export function useSurfacePaletteSlots(): SurfacePaletteSlots {
  const palette = useSurfacePalette();
  return useMemo(() => slotsFor(palette), [palette]);
}

export interface SurfacePaletteVarsProps {
  /** Apply the vars to this element instead of the document root. */
  target?: 'documentElement' | 'body';
  /** Optional children — render-passthrough convenience. */
  children?: ReactNode;
}

/**
 * Side-effect component that writes the current Surface's palette to CSS
 * custom properties. Renders `children` (if any) verbatim — typical mount
 * point is inside the AetherProvider so every nested consumer sees the
 * vars without rerendering.
 *
 * The vars are removed on unmount so the document doesn't carry stale
 * palette state into other shells.
 */
export function SurfacePaletteVars({
  target = 'documentElement',
  children,
}: SurfacePaletteVarsProps): React.ReactElement {
  const palette = useSurfacePalette();

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const el = target === 'body' ? document.body : document.documentElement;
    const slots = slotsFor(palette);
    const writes: Array<readonly [string, string]> = [
      [`--aether-palette-0`, palette[0]],
      [`--aether-palette-1`, palette[1]],
      [`--aether-palette-2`, palette[2]],
      [`--aether-palette-3`, palette[3]],
      [`--aether-palette-4`, palette[4]],
      [`--aether-palette-ink`, slots.ink],
      [`--aether-palette-surface`, slots.surface],
      [`--aether-palette-accent`, slots.accent],
      [`--aether-palette-glow`, slots.glow],
      [`--aether-palette-support`, slots.support],
    ];
    for (const [k, v] of writes) {
      el.style.setProperty(k, v);
    }
    return () => {
      for (const [k] of writes) {
        el.style.removeProperty(k);
      }
    };
  }, [palette, target]);

  return <>{children}</>;
}

/** Re-export the default so consumers can spread + override without
 *  importing from the pure file directly. */
export { DEFAULT_SURFACE_PALETTE };
