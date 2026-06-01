/**
 * AE425 — pure helpers for the Live trip-watch feature (Tier 4 T4-Ag.2).
 *
 * Per 04-sequencing.md Phase 3: "Live trip-watch (Tier 4 T4-Ag.2)
 * wired. Real public launch." The eventual integration streams a
 * traveller's current waypoint over WebTransport so the Atlas surface
 * can show a pulsing "live" presence dot above the trip timeline.
 *
 * AE425 ships the data model + the local feature scaffold: a presence
 * overlay on the Atlas shell that surfaces `{liveLocation, lastSeenAt,
 * mode}` for the active trip. The WebTransport receiver + the real
 * presence stream land in AE425b once the channel is online.
 *
 * Pure — no React, no R3F, no SDK.
 */

/** A single live presence frame from the trip-watch channel. */
export interface LiveTripPresence {
  readonly tripId: string;
  /** Traveller's current latitude (degrees). */
  readonly lat: number;
  /** Traveller's current longitude (degrees). */
  readonly lng: number;
  /** Speed in km/h, or null if the device hasn't reported velocity. */
  readonly speedKmH: number | null;
  /** ISO-8601 timestamp of the last presence frame. Drives the "live"
   *  vs "stale" gate via `presenceFreshness`. */
  readonly reportedAt: string;
  /** Mode tag: 'walking' / 'transit' / 'driving' / 'still' / 'unknown'.
   *  Used by the surface to pick the right glyph + dot colour. */
  readonly mode: string;
}

/** How "live" the presence frame is, given a freshness threshold. */
export type LiveTripFreshness = 'live' | 'recent' | 'stale';

/** Threshold (ms) — frames newer than this are "live"; older but
 *  within `STALE_THRESHOLD_MS` are "recent" (faded dot); past that
 *  are "stale" (we stop displaying the dot). */
export const LIVE_FRESHNESS_MS = 30_000;
export const STALE_THRESHOLD_MS = 5 * 60_000;

/** Decide the freshness tier for a presence frame. */
export function presenceFreshness(
  frame: LiveTripPresence | null,
  now: number = Date.now(),
  liveMs: number = LIVE_FRESHNESS_MS,
  staleMs: number = STALE_THRESHOLD_MS,
): LiveTripFreshness {
  if (frame === null) return 'stale';
  const t = new Date(frame.reportedAt).getTime();
  if (!Number.isFinite(t)) return 'stale';
  const delta = now - t;
  if (delta < 0) return 'live';
  if (delta <= liveMs) return 'live';
  if (delta <= staleMs) return 'recent';
  return 'stale';
}

/** Human-readable "Live · 8s ago" / "Recent · 2m ago" / "Stale" line. */
export function presenceFreshnessLabel(
  frame: LiveTripPresence | null,
  now: number = Date.now(),
): string {
  if (frame === null) return 'No live signal';
  const t = new Date(frame.reportedAt).getTime();
  if (!Number.isFinite(t)) return 'No live signal';
  const delta = Math.max(0, now - t);
  const tier = presenceFreshness(frame, now);
  const ago =
    delta < 60_000
      ? `${Math.floor(delta / 1_000)}s ago`
      : delta < 3_600_000
        ? `${Math.floor(delta / 60_000)}m ago`
        : `${Math.floor(delta / 3_600_000)}h ago`;
  switch (tier) {
    case 'live':
      return `Live · ${ago}`;
    case 'recent':
      return `Recent · ${ago}`;
    case 'stale':
      return `Stale · ${ago}`;
  }
}

/** Dot colour per freshness tier. Live = vivid; recent = dimmer; stale
 *  is gated out by the component before this is called. */
export function presenceDotColor(tier: LiveTripFreshness): string {
  switch (tier) {
    case 'live':
      return '#34D399';
    case 'recent':
      return '#86EFAC';
    case 'stale':
      return '#6B7280';
  }
}

/** Glyph the overlay shows next to the dot to hint at travel mode. */
export function presenceModeGlyph(mode: string): string {
  switch (mode.toLowerCase()) {
    case 'walking':
      return '🚶';
    case 'driving':
      return '🚗';
    case 'transit':
      return '🚌';
    case 'still':
      return '◯';
    default:
      return '◆';
  }
}

/** Format the speed line. Null collapses to em-dash so the overlay
 *  doesn't lie when the device hasn't reported velocity. */
export function presenceSpeedLabel(speedKmH: number | null): string {
  if (speedKmH === null || !Number.isFinite(speedKmH)) return '— km/h';
  return `${Math.round(speedKmH)} km/h`;
}

/** Compose the overlay aria-live announcement. */
export function presenceAnnouncement(
  frame: LiveTripPresence | null,
  now: number = Date.now(),
): string {
  if (frame === null) return 'No live presence';
  return `Live trip-watch: ${presenceFreshnessLabel(frame, now)}, ${frame.mode}, ${presenceSpeedLabel(
    frame.speedKmH,
  )}`;
}
