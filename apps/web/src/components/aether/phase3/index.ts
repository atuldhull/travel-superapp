/**
 * Aether Phase 3 — Echo (social feed) + Mirror (admin forensics) +
 * live trip-watch barrel.
 *
 * Mirrors the Phase 1 + Phase 2 barrels. Behaviour-neutral cleanup —
 * adds a single import surface for the Phase 4 native package +
 * Storybook fixtures to consume from.
 *
 * Most pure helpers re-export from `@app/aether-canvas-shared` (Round
 * AK + AL); the React components live locally in this folder.
 */

// Echo (social feed) ----------------------------------------------------------

export {
  ECHO_SWIPE_NOISE_PX,
  boostHexColor,
  echoActionForSwipe,
  echoPaletteFromDominantColor,
  echoSwipeDirectionFromDelta,
  formatEchoPostedAt,
  nextEchoIndex,
  type EchoAction,
  type EchoItem,
  type EchoSwipeDirection,
} from './echo-feed';

export {
  ECHO_CARD_HEIGHT,
  ECHO_CARD_SPACING_Y,
  ECHO_CARD_WIDTH,
  echoCardOpacity,
  echoCardScale,
  echoCardVisible,
  echoCardY,
  visibleEchoSlots,
} from './echo-layout';

export {
  EchoFeedProvider,
  useEchoFeed,
  type EchoFeedProviderProps,
  type EchoFeedValue,
} from './echo-context';

export { SAMPLE_ECHO_FEED } from './echo-sample-feed';

export { Phase3EchoShell } from './phase3-echo-shell';

export { ECHO_WHEEL_THROTTLE_MS, useEchoSwipe, type UseEchoSwipeOptions } from './use-echo-swipe';

// Mirror (admin forensics) ----------------------------------------------------

export {
  MIRROR_AUDIT_RIVER_TTL_MS,
  MIRROR_GLOBE_RADIUS,
  auditGlyphColor,
  auditGlyphSymbol,
  auditRowYProgress,
  isMirrorViewer,
  latLngToVec3,
  liveAuditRows,
  scamClusterRadius,
  sosDotRadius,
  type MirrorAuditRow,
  type MirrorSOSEvent,
  type MirrorScamCluster,
} from './mirror-globe';

export {
  filterUserSuggestions,
  formatInvestigationCount,
  highlightRange,
  investigationAnnouncement,
  investigationSeverity,
  isInvestigationHotkey,
  type MirrorInvestigation,
  type MirrorInvestigationSeverity,
  type MirrorUserSuggestion,
} from './mirror-investigate';

export { MirrorInvestigatePalette } from './mirror-investigate-palette';

export { MirrorAuditRiver, type MirrorAuditRiverProps } from './mirror-audit-river';

export { Phase3MirrorShell } from './phase3-mirror-shell';

export { SAMPLE_MIRROR_AUDIT, SAMPLE_MIRROR_SCAM, SAMPLE_MIRROR_SOS } from './mirror-sample-data';

export {
  SAMPLE_MIRROR_INVESTIGATIONS,
  SAMPLE_MIRROR_USERS,
} from './mirror-investigate-sample-data';

// Live trip-watch (Tier 4 T4-Ag.2) -------------------------------------------

export {
  LIVE_FRESHNESS_MS,
  STALE_THRESHOLD_MS,
  presenceAgoLabel,
  presenceAnnouncement,
  presenceDotColor,
  presenceFreshness,
  presenceFreshnessLabel,
  presenceModeGlyph,
  presenceSpeedLabel,
  type LiveTripFreshness,
  type LiveTripPresence,
} from './live-trip-watch';

export { LiveTripWatchOverlay, type LiveTripWatchOverlayProps } from './live-trip-watch-overlay';
