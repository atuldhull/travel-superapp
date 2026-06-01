/**
 * AE409 — pure helpers for Lumen "museum mode" arc layout.
 *
 * Per docs/aether/02-surfaces.md §4 Lumen: "Pinch-zoom to enter a
 * single photo. The photo becomes a wall; the rest of the trip's
 * photos arrange themselves in 3D around it like a museum."
 *
 * The focused photo stays at its cloud position (the camera dollies to
 * it via AE402). Other photos rearrange onto a semicircular arc that
 * wraps from the focused plane's left to its right, sitting BEHIND the
 * focused plane at a configurable radius. The viewer (camera at focused
 * z + dollyZ) sees the focused plane front-and-centre with the others
 * fanning around it like paintings in a gallery's corner.
 *
 * Pure — no React, no R3F. The scene calls `museumArcPositions` once
 * per `(focusedId, planes)` change via `useMemo`, then feeds the
 * resolved target into each animated slot's per-frame position lerp.
 */
import type { LumenPlaneLayout } from './lumen-cloud';
import type { Vec3Tuple } from './lifecycle-camera';

/** Tunables for the museum arc. The defaults are anchored to the
 *  AE402 dolly distance (2.4 world units in front of the focused plane)
 *  so the arc radius reads as "behind the viewer's peripheral vision". */
export interface MuseumArcConfig {
  /** Arc radius from the focused plane to each other plane. */
  readonly radius: number;
  /** Angular span of the arc in radians. π = half-circle (default). */
  readonly arcSpanRadians: number;
  /** Push the arc centre this far behind the focused plane along -Z. */
  readonly depthOffset: number;
  /** Vertical compression: each other plane keeps a fraction of its
   *  original Y offset from the focused plane. 0 → perfectly flat arc;
   *  1 → preserve the rating axis. The default 0.35 preserves the hint
   *  without scattering planes too vertically to read as "a wall". */
  readonly verticalCompression: number;
}

export const DEFAULT_MUSEUM_ARC: MuseumArcConfig = Object.freeze({
  radius: 4.5,
  arcSpanRadians: Math.PI,
  depthOffset: 0,
  verticalCompression: 0.35,
});

/** Build the museum-mode position map for the given focus state.
 *
 *  Returns a Map keyed by plane id. The focused plane's own entry is
 *  included so callers can look up every plane in a single Map.get()
 *  without branching on id-equality.
 *
 *  Returns an empty Map when:
 *    - `focusedId` is null (caller uses cloud positions directly)
 *    - `focusedId` doesn't appear in the planes array
 *
 *  Algorithm:
 *    1. Sort the other planes by their current X (time axis) so the
 *       arc reads chronologically left → right.
 *    2. Spread them across the arc, with angle ∈ [-span/2, +span/2].
 *    3. Each plane sits at:
 *         x = focused.x + sin(angle) * radius
 *         y = focused.y + (its.y - focused.y) * verticalCompression
 *         z = focused.z - depthOffset - cos(angle) * radius
 *       so angle=0 puts the plane directly behind focused, ±span/2
 *       puts it to the left/right at the focused plane's z. */
export function museumArcPositions(
  planes: ReadonlyArray<LumenPlaneLayout>,
  focusedId: string | null,
  config: MuseumArcConfig = DEFAULT_MUSEUM_ARC,
): Map<string, Vec3Tuple> {
  const result = new Map<string, Vec3Tuple>();
  if (focusedId === null) return result;
  const focused = planes.find((p) => p.id === focusedId);
  if (focused === undefined) return result;

  // The focused plane stays put — record so callers don't branch.
  result.set(focused.id, [
    focused.position[0],
    focused.position[1],
    focused.position[2],
  ] as Vec3Tuple);

  const others = planes.filter((p) => p.id !== focusedId);
  if (others.length === 0) return result;

  // Sort by current X (time axis), tie-break by id for stability.
  const sorted = [...others].sort((a, b) => {
    const dx = a.position[0] - b.position[0];
    if (dx !== 0) return dx;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const [fx, fy, fz] = focused.position;
  const span = config.arcSpanRadians;
  const r = config.radius;
  const depth = config.depthOffset;
  const vcomp = config.verticalCompression;

  sorted.forEach((p, i) => {
    // t ∈ [0, 1]. Single other plane sits at centre (t=0.5).
    const t = sorted.length === 1 ? 0.5 : i / (sorted.length - 1);
    const angle = (t - 0.5) * span;
    const x = fx + Math.sin(angle) * r;
    const y = fy + (p.position[1] - fy) * vcomp;
    const z = fz - depth - Math.cos(angle) * r;
    result.set(p.id, [x, y, z] as Vec3Tuple);
  });

  return result;
}

/** Resolve the museum-mode target position for a single plane. When
 *  nothing is focused (or the lookup misses) the plane keeps its own
 *  cloud position so the per-frame lerp converges to the rest pose.
 *
 *  Prefer `museumArcPositions(...)` + `Map.get(id)` when iterating many
 *  planes — this convenience builds the same Map every call and is O(n²)
 *  if abused in a loop. */
export function resolveMuseumTarget(
  plane: LumenPlaneLayout,
  focusedId: string | null,
  planes: ReadonlyArray<LumenPlaneLayout>,
  config: MuseumArcConfig = DEFAULT_MUSEUM_ARC,
): Vec3Tuple {
  if (focusedId === null) {
    return [plane.position[0], plane.position[1], plane.position[2]] as Vec3Tuple;
  }
  const map = museumArcPositions(planes, focusedId, config);
  const m = map.get(plane.id);
  if (m !== undefined) return m;
  return [plane.position[0], plane.position[1], plane.position[2]] as Vec3Tuple;
}
