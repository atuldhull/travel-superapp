/**
 * Lumen photo-cloud layout — pure helpers (AE456).
 *
 * Moved from `apps/web/src/components/aether/phase2/lumen-cloud.ts` into
 * the Phase 4 shared sub-package so both web R3F and native R3F arrange
 * the photo cloud with identical world coordinates.
 *
 * Per docs/aether/02-surfaces.md §4 Lumen, photos float in 3D space
 * "sorted by capture time on a horizontal axis and by your rating on
 * a vertical axis (high-rated photos float to the top of the cloud)".
 *
 * No React, no R3F, no fetch. The Lumen scene calls these with a
 * normalised photo list (timestamps + ratings) and renders the
 * resulting `(x, y, z)` positions as planes.
 */

/** Minimal shape Lumen reads from a `MediaItemDto`. Declared locally so
 *  these helpers stay framework-agnostic + testable without orval. */
export interface LumenPhotoLike {
  readonly id: string;
  /** Capture timestamp (ISO string) — drives the X axis. */
  readonly capturedAt: string | null;
  /** User-provided rating 1..5 — drives the Y axis. Null sinks to
   *  the bottom of the cloud so unrated photos read as "to-be-judged". */
  readonly rating: number | null;
  /** Pre-signed download URL or null while pending. */
  readonly url: string | null;
}

/** Layout configuration — axes lengths in world units, default
 *  rating gravity. The Lumen scene uses these so day-marker camera +
 *  the photo plane scale stay in sync. */
export interface LumenLayoutConfig {
  /** Time axis length (world units). Photos spread across this range. */
  readonly axisLengthX: number;
  /** Rating axis length (world units). Highest-rated photos at y=top. */
  readonly axisLengthY: number;
  /** Z-jitter range so dense clusters don't overlap. */
  readonly jitterZ: number;
  /** Plane size for an average-interest photo. */
  readonly planeBaseSize: number;
}

export const DEFAULT_LUMEN_LAYOUT: LumenLayoutConfig = Object.freeze({
  axisLengthX: 18,
  axisLengthY: 8,
  jitterZ: 1.6,
  planeBaseSize: 1.6,
});

/** Resolved per-photo position + size for the R3F scene. */
export interface LumenPlaneLayout {
  readonly id: string;
  readonly position: readonly [number, number, number];
  readonly size: number;
  /** When null the scene shows a placeholder palette tint instead of
   *  an image — the photo data hasn't loaded yet. */
  readonly url: string | null;
}

/** Clamp a numeric rating to [0, 5] with NaN/Infinity collapsing to 0.
 *  Public so tests can pin boundary values + the receiver toast can
 *  format the rating consistently. */
export function clampRating(r: number | null | undefined): number {
  if (r === null || r === undefined) return 0;
  if (!Number.isFinite(r)) return 0;
  if (r < 0) return 0;
  if (r > 5) return 5;
  return r;
}

/** Map a capture timestamp + the cloud's [min, max] range to an x
 *  coordinate in `[-axisLength/2, +axisLength/2]`. Null / invalid
 *  collapses to 0 (centre). Degenerate range (min == max) collapses
 *  every photo to 0 to avoid divide-by-zero. */
export function timeToX(
  capturedAt: string | null,
  minMs: number,
  maxMs: number,
  axisLength: number,
): number {
  if (capturedAt === null || capturedAt === '') return 0;
  const d = new Date(capturedAt);
  const t = d.getTime();
  if (!Number.isFinite(t)) return 0;
  if (maxMs <= minMs) return 0;
  const norm = (t - minMs) / (maxMs - minMs);
  return (norm - 0.5) * axisLength;
}

/** Map a rating to a y coordinate. Rating 5 → +axisLength/2 (top);
 *  rating 0 / null → -axisLength/2 (bottom). Other ratings interpolate
 *  linearly so 2.5 sits at y=0. */
export function ratingToY(rating: number | null | undefined, axisLength: number): number {
  const r = clampRating(rating);
  const norm = r / 5;
  return (norm - 0.5) * axisLength;
}

/** Deterministic per-id z-jitter so photos with the same capture time
 *  + rating don't z-fight. Uses a simple bit hash so the layout is
 *  stable across renders without needing a seeded RNG context. */
export function jitterZFor(id: string, range: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  }
  // Normalise the 32-bit hash to [-0.5, 0.5] then scale.
  const norm = ((h >>> 0) % 1000) / 1000 - 0.5;
  return norm * range;
}

/** Build the full per-photo layout list for the Lumen scene.
 *
 *  Algorithm:
 *    1. Find the min + max captured timestamps across the photo list
 *       (skipping null / invalid). If everything is null, every photo
 *       collapses to x=0.
 *    2. For each photo:
 *       - x ← `timeToX(capturedAt, min, max, axisLengthX)`
 *       - y ← `ratingToY(rating, axisLengthY)`
 *       - z ← `jitterZFor(id, jitterZ)`
 *       - size ← `planeBaseSize` (future: scale by interest score)
 *
 *  Returns a frozen-by-convention array of layouts. */
export function layoutPhotoCloud(
  photos: ReadonlyArray<LumenPhotoLike>,
  config: LumenLayoutConfig = DEFAULT_LUMEN_LAYOUT,
): ReadonlyArray<LumenPlaneLayout> {
  if (photos.length === 0) return [];
  const captured: number[] = [];
  for (const p of photos) {
    if (p.capturedAt === null || p.capturedAt === '') continue;
    const t = new Date(p.capturedAt).getTime();
    if (Number.isFinite(t)) captured.push(t);
  }
  const minMs = captured.length === 0 ? 0 : Math.min(...captured);
  const maxMs = captured.length === 0 ? 0 : Math.max(...captured);
  return photos.map((p) => ({
    id: p.id,
    position: [
      timeToX(p.capturedAt, minMs, maxMs, config.axisLengthX),
      ratingToY(p.rating, config.axisLengthY),
      jitterZFor(p.id, config.jitterZ),
    ] as const,
    size: config.planeBaseSize,
    url: p.url,
  }));
}

/** Convenience: sort photos by `capturedAt` ascending. Stable on ties
 *  (preserves input order). Null timestamps sink to the end so the
 *  scene reads them as "to-be-tagged". */
export function sortPhotosByTime(
  photos: ReadonlyArray<LumenPhotoLike>,
): ReadonlyArray<LumenPhotoLike> {
  return [...photos].sort((a, b) => {
    const ta = a.capturedAt === null ? Number.POSITIVE_INFINITY : new Date(a.capturedAt).getTime();
    const tb = b.capturedAt === null ? Number.POSITIVE_INFINITY : new Date(b.capturedAt).getTime();
    const taSafe = Number.isFinite(ta) ? ta : Number.POSITIVE_INFINITY;
    const tbSafe = Number.isFinite(tb) ? tb : Number.POSITIVE_INFINITY;
    return taSafe - tbSafe;
  });
}
