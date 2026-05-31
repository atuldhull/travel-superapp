/**
 * Surface module — barrel export.
 *
 * Consumers should import from this module (or from the package root) and
 * never reach into individual files; that lets internal refactors stay
 * private.
 */
export type {
  Surface,
  SurfaceId,
  SurfaceLifecyclePhase,
  SurfaceMountLoader,
  SurfaceMountProps,
  SurfaceRouteMatch,
} from './types';

export {
  SURFACE_PHASE_ORDER,
  canTransition,
  isTerminalPhase,
  nextLifecyclePhase,
} from './lifecycle';

export { matchSurfaceRoute, overlaySurfaces, routeToSurface } from './route-to-surface';

export { SurfaceRegistry, createSurfaceRegistry } from './registry';

export {
  SurfaceManagerProvider,
  useCurrentSurface,
  useSurfaceLifecycle,
  useSurfaceManager,
  type SurfaceManagerProviderProps,
  type SurfaceManagerState,
} from './manager';

export { SurfaceMountFrame, type SurfaceMountFrameProps } from './mount';

export {
  DEFAULT_SURFACE_PALETTE,
  blendHex,
  blendPalettes,
  isValidPalette,
  paletteForSurface,
  slotsFor,
  type SurfacePalette,
  type SurfacePaletteSlots,
} from './palette';

export {
  SurfacePaletteOverride,
  SurfacePaletteVars,
  useSurfacePalette,
  useSurfacePaletteSlots,
  type SurfacePaletteOverrideProps,
  type SurfacePaletteVarsProps,
} from './palette-hooks';

export {
  DESTINATION_PALETTES,
  extractDestinationSlugFromTitle,
  hasCuratedPalette,
  paletteCuratedSlugs,
  paletteForDestination,
} from './destination-palettes';
