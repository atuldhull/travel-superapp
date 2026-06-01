/**
 * Upcoming trip helpers — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE480 so the Phase 4
 * native Drift Now Card surfaces the same upcoming-trip-aware copy.
 * This file remains so existing imports keep working.
 */
export {
  daysUntil,
  nowCardPersonalised,
  pickUpcomingTrip,
  type UpcomingTripLike,
} from '@app/aether-canvas-shared';
