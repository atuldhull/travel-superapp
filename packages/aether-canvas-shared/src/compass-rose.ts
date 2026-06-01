/**
 * Compass Phase 1 — pure bearing / cardinal math (AE456).
 *
 * Moved from `apps/web/src/components/aether/phase1/compass-rose.ts`
 * into the Phase 4 shared sub-package so both web R3F and native R3F
 * render the compass needle + cardinal markers with identical bearings.
 *
 * The Phase 1 Compass scene (per docs/aether/02-surfaces.md §5 Compass Bird)
 * eventually renders a top-down 3D city block. AE379 ships the scaffolding:
 * a compass rose disc + cardinal direction markers + a needle that points
 * to a configurable bearing.
 *
 * Conventions:
 *   • Bearings are degrees clockwise from north, where:
 *       0°   = North (+Z away from viewer in the top-down scene's frame)
 *       90°  = East
 *       180° = South
 *       270° = West
 *   • The compass rose lies on the XZ plane (y = 0). The needle's tip
 *     points in the direction `bearingToVec3(degrees)`, the tail in the
 *     opposite direction.
 *   • `radius` is the disc radius the markers sit on; callers pass it in
 *     world units.
 *
 * Pure — tested without R3F.
 */

export interface CompassPosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Normalise a bearing to [0, 360). Accepts negatives + multiples. */
export function normalizeBearing(degrees: number): number {
  if (!Number.isFinite(degrees)) return 0;
  let d = degrees % 360;
  if (d < 0) d += 360;
  return d;
}

/** Unit vector pointing along the given bearing on the XZ plane.
 *
 *  We want 0° = +Z (north away from camera in our top-down frame). The
 *  standard polar conversion maps θ to (sin, cos) which gives us:
 *    bearing 0   → (0,  1)  = +Z (north)
 *    bearing 90  → (1,  0)  = +X (east)
 *    bearing 180 → (0, -1)  = -Z (south)
 *    bearing 270 → (-1, 0)  = -X (west)
 *  Y is always 0 in this layout. */
export function bearingToVec3(degrees: number): CompassPosition {
  const d = normalizeBearing(degrees);
  const rad = (d * Math.PI) / 180;
  return {
    x: Math.sin(rad),
    y: 0,
    z: Math.cos(rad),
  };
}

/** Scaled bearing position — same direction as `bearingToVec3` but on a
 *  ring of `radius`. */
export function bearingPositionOnRing(degrees: number, radius: number): CompassPosition {
  const v = bearingToVec3(degrees);
  return { x: v.x * radius, y: v.y, z: v.z * radius };
}

/** The four cardinal direction labels with their bearings. Used by the
 *  scene to lay out markers and also for `cardinalAt` lookup. */
export const CARDINALS: ReadonlyArray<{ label: 'N' | 'E' | 'S' | 'W'; bearing: number }> = [
  { label: 'N', bearing: 0 },
  { label: 'E', bearing: 90 },
  { label: 'S', bearing: 180 },
  { label: 'W', bearing: 270 },
];

/** Closest cardinal direction to the given bearing. Ties (45°, 135°,
 *  225°, 315°) round clockwise so 45° → 'E' (not 'N'). */
export function cardinalAt(degrees: number): 'N' | 'E' | 'S' | 'W' {
  const d = normalizeBearing(degrees);
  if (d < 45) return 'N';
  if (d < 135) return 'E';
  if (d < 225) return 'S';
  if (d < 315) return 'W';
  return 'N';
}

/** Angle between two bearings in degrees, always in [0, 180]. */
export function angularDistance(a: number, b: number): number {
  const na = normalizeBearing(a);
  const nb = normalizeBearing(b);
  const diff = Math.abs(na - nb);
  return diff > 180 ? 360 - diff : diff;
}
