/** Aether Phase 1 — Surface registry + Drift + Atlas + Compass shells barrel. */
export { Phase1DriftShell } from './phase1-drift-shell';
export { Phase1AtlasShell, type Phase1AtlasShellProps } from './phase1-atlas-shell';
export { Phase1CompassShell, type Phase1CompassShellProps } from './phase1-compass-shell';
export { createAetherPhase1Registry } from './aether-registry';
export {
  BREATHING_LIFECYCLE_PLAN,
  DEFAULT_LIFECYCLE_PLAN,
  nextPhaseInChain,
  nextScheduledPhase,
  phaseDelayFor,
  useLifecycleAutoDriver,
  type LifecyclePlan,
} from './use-lifecycle-driver';
export {
  DEFAULT_ATLAS_LAYOUT,
  dayPositionOnAxis,
  layoutDayMarkers,
  layoutOrbsForTrip,
  orbColorForItem,
  orbSizeForItem,
  orbZForSlot,
  type AtlasDayLike,
  type AtlasItemLike,
  type AtlasLayoutConfig,
  type DayMarkerLayout,
  type OrbLayout,
} from './atlas-orbs';
export {
  TripDataProvider,
  useTripData,
  type TripDataContextValue,
  type TripDataLike,
  type TripDataProviderProps,
} from './trip-data-context';
export {
  CARDINALS,
  angularDistance,
  bearingPositionOnRing,
  bearingToVec3,
  cardinalAt,
  normalizeBearing,
  type CompassPosition,
} from './compass-rose';
export {
  CompassBearingProvider,
  useCompassBearing,
  type CompassBearingProviderProps,
} from './compass-bearing-context';
export {
  DEFAULT_DISSOLVE_MS,
  delayedNavigate,
  useDissolvingNavigate,
  type DelayedNavigateCancel,
  type DissolvingNavigate,
} from './dissolving-navigate';
export { DissolvingLink, isInAppClick, type DissolvingLinkProps } from './dissolving-link';
export { Phase1DevNav, type Phase1DevNavProps } from './phase1-dev-nav';
export {
  nowCardContent,
  nowCardContentNow,
  timeBandFor,
  type NowCardContent,
  type TimeBand,
} from './now-card-content';
export { DriftNowCard, type DriftNowCardProps } from './drift-now-card';
export {
  DEFAULT_NOW_CARD_DURATIONS,
  nowCardCssForPhase,
  nowCardOpacityForPhase,
  nowCardScaleForPhase,
  nowCardTransitionMs,
  type LifecycleDurationsMs,
} from './now-card-lifecycle';
export {
  handlerKeyForPhase,
  useLifecycleEvents,
  type LifecycleEventHandlers,
} from './use-lifecycle-events';
