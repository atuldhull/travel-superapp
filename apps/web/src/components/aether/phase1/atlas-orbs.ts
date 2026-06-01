/**
 * Atlas orb layout — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE456 so the Phase 4
 * native Atlas scene consumes identical world coordinates. This file
 * remains so existing imports keep working.
 */
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
} from '@app/aether-canvas-shared';
