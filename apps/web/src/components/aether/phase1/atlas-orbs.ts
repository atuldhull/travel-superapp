/**
 * Atlas Phase 1 — pure orb layout math.
 *
 * Given the itinerary days (from `useTripControllerGetItinerary`), compute
 * the world-space position for each place orb the R3F scene will render.
 * The layout distributes days along the X axis (the timeline) and stacks
 * day-items on the Z axis (perpendicular to the timeline).
 *
 * Pure functions — no React, no Three. Tested as plain math.
 *
 * Coordinate convention (Three's default):
 *   +X right  — timeline forward (start → end)
 *   +Y up     — orb height; AE378 keeps everything on the y=0 plane
 *   +Z toward viewer — perpendicular stacking
 *
 * AE375's DEFAULT_CAMERA_SCRIPT puts the camera at [0, 0, 6] looking at
 * origin; we choose an axisLength of 16 world units so a 7-day trip
 * spreads across a comfortable visual width without orbs crowding.
 */

/** Minimal Itinerary item shape. Matches `ItineraryItemDto` from
 *  `@app/sdk` (which is `// @ts-nocheck`'d so we restate the fields
 *  AE378 cares about — id, position, placeId). */
export interface AtlasItemLike {
  readonly id: string;
  readonly position: number;
  readonly placeId: string | null;
}

/** Minimal Itinerary day shape. Matches `ItineraryDayDto`'s shape. */
export interface AtlasDayLike {
  readonly id: string;
  readonly dayIndex: number;
  readonly date: string;
  readonly items: ReadonlyArray<AtlasItemLike>;
}

/** World-space orb placement, ready for R3F. */
export interface OrbLayout {
  readonly id: string;
  readonly dayIndex: number;
  readonly itemPosition: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly placeId: string | null;
}

/** Day-marker placement — the small tick along the axis under each day. */
export interface DayMarkerLayout {
  readonly dayIndex: number;
  readonly date: string;
  readonly x: number;
}

export interface AtlasLayoutConfig {
  /** Total length of the timeline in world units. */
  readonly axisLength: number;
  /** Spacing between stacked orbs on the same day. */
  readonly orbZSpacing: number;
  /** Soft cap on visible stacks per day — extras clamp to the last slot. */
  readonly maxOrbsPerSlot: number;
}

/** Tuned to AE375's default camera at [0, 0, 6] looking at origin. */
export const DEFAULT_ATLAS_LAYOUT: AtlasLayoutConfig = {
  axisLength: 16,
  orbZSpacing: 0.45,
  maxOrbsPerSlot: 6,
};

/** Where a given day sits along the timeline axis. Days are distributed
 *  uniformly between `-axisLength/2` and `+axisLength/2`. A single-day
 *  trip lands at x = 0. */
export function dayPositionOnAxis(dayIndex: number, totalDays: number, axisLength: number): number {
  if (totalDays <= 0) return 0;
  if (totalDays === 1) return 0;
  if (dayIndex <= 0) return -axisLength / 2;
  if (dayIndex >= totalDays - 1) return axisLength / 2;
  const t = dayIndex / (totalDays - 1);
  return -axisLength / 2 + t * axisLength;
}

/** Z-offset for an orb in slot `slotIdx` of `totalSlots`. Slots alternate
 *  symmetrically around z = 0, so the centre slot is closest to the
 *  camera-facing axis. */
export function orbZForSlot(slotIdx: number, totalSlots: number, spacing: number): number {
  if (totalSlots <= 1) return 0;
  const centred = slotIdx - (totalSlots - 1) / 2;
  return centred * spacing;
}

/** Lay out every orb for a trip's itinerary. Items are ordered by their
 *  `position` field per day; items past `maxOrbsPerSlot` collapse onto
 *  the last visible slot so the visualisation stays legible for
 *  pathological data (50-item days etc.). */
export function layoutOrbsForTrip(
  days: ReadonlyArray<AtlasDayLike>,
  config: AtlasLayoutConfig = DEFAULT_ATLAS_LAYOUT,
): ReadonlyArray<OrbLayout> {
  if (days.length === 0) return [];
  const out: OrbLayout[] = [];
  for (const day of days) {
    const items = [...day.items].sort((a, b) => a.position - b.position);
    const totalSlots = Math.min(items.length, config.maxOrbsPerSlot);
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i] as AtlasItemLike;
      const clampedSlot = Math.min(i, config.maxOrbsPerSlot - 1);
      out.push({
        id: item.id,
        dayIndex: day.dayIndex,
        itemPosition: item.position,
        x: dayPositionOnAxis(day.dayIndex, days.length, config.axisLength),
        y: 0,
        z: orbZForSlot(clampedSlot, totalSlots, config.orbZSpacing),
        placeId: item.placeId,
      });
    }
  }
  return out;
}

/** Compute one marker per day along the timeline. */
export function layoutDayMarkers(
  days: ReadonlyArray<AtlasDayLike>,
  config: AtlasLayoutConfig = DEFAULT_ATLAS_LAYOUT,
): ReadonlyArray<DayMarkerLayout> {
  if (days.length === 0) return [];
  return days.map((d) => ({
    dayIndex: d.dayIndex,
    date: d.date,
    x: dayPositionOnAxis(d.dayIndex, days.length, config.axisLength),
  }));
}

/** Visual size of an orb. AE378 ships a fixed size; later slices key it
 *  to interest / dwell / rating. Keep as a function so the consumer can
 *  override without rewiring layout math. */
export function orbSizeForItem(_item: AtlasItemLike): number {
  return 0.18;
}

/** Hex colour for an orb. For AE378 every orb is theme.palette.ochre.glow;
 *  later slices key it to place category once that lands. */
export function orbColorForItem(_item: AtlasItemLike, themeAccent: string): string {
  return themeAccent;
}
