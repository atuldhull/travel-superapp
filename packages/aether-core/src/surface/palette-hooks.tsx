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
import { useEffect, useMemo, type ReactNode } from 'react';
import { useCurrentSurface } from './manager';
import {
  DEFAULT_SURFACE_PALETTE,
  paletteForSurface,
  slotsFor,
  type SurfacePalette,
  type SurfacePaletteSlots,
} from './palette';

/** Resolved palette for the current Surface. Falls back to
 *  `DEFAULT_SURFACE_PALETTE` when no Surface is active or its
 *  `palette` slot is empty. */
export function useSurfacePalette(): SurfacePalette {
  const current = useCurrentSurface();
  return useMemo(() => paletteForSurface(current), [current]);
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
