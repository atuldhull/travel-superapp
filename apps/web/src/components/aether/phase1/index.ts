/** Aether Phase 1 — Surface registry + Drift + Atlas shells barrel. */
export { Phase1DriftShell } from './phase1-drift-shell';
export { Phase1AtlasShell, type Phase1AtlasShellProps } from './phase1-atlas-shell';
export { createAetherPhase1Registry } from './aether-registry';
export {
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
