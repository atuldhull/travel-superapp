/**
 * Live trip-watch helpers — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE477 so the Phase 4
 * native presence overlay consumes identical freshness math + mode
 * glyphs + speed labels + announcer copy. This file remains so
 * existing imports keep working.
 */
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
} from '@app/aether-canvas-shared';
