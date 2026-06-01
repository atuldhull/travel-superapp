/**
 * AE410 — pure layout strategies for the Lumen photo cloud.
 *
 * The "arrange" gesture in 02-surfaces.md §4 calls for the user to
 * say (via Pulse) "show me the warm photos" or "arrange by mood" and
 * have the cloud re-cluster. That endpoint chain — Pulse → ai-service
 * `/v1/embeddings` → re-cluster — needs a CLIP embedding service that
 * Phase 2 doesn't have wired yet.
 *
 * AE410 ships the LAYOUT side of the contract: the same photo list
 * can be re-arranged into multiple geometric shapes (time-cloud, flat
 * grid, golden-angle spiral, museum wall). The "mood" strategy is
 * defined but its position fn falls back to the time-cloud layout
 * until the CLIP embedding lands — that's the honest scaffold pattern
 * established by AE406/AE407 (state machine + UI ship; backend lands
 * later). The arrange menu in `<LumenArrangeMenu>` lets the user
 * switch strategies right now without needing the AI bit yet.
 *
 * Pure — no React, no R3F. Each strategy is a `LumenPhotoLike[] →
 * LumenPlaneLayout[]` function that the scene calls in `useMemo`.
 */
import {
  DEFAULT_LUMEN_LAYOUT,
  jitterZFor,
  layoutPhotoCloud,
  type LumenLayoutConfig,
  type LumenPhotoLike,
  type LumenPlaneLayout,
} from './lumen-cloud';

/** The four layout strategies the user can switch between. */
export type LumenLayoutStrategy = 'time' | 'grid' | 'spiral' | 'wall' | 'mood';

/** All known strategies in display order. The arrange menu maps over
 *  this so adding a strategy here surfaces it in the UI for free. */
export const LUMEN_LAYOUT_STRATEGIES: ReadonlyArray<LumenLayoutStrategy> = Object.freeze([
  'time',
  'grid',
  'spiral',
  'wall',
  'mood',
]);

/** Human-readable label for the arrange menu. Stays short — the menu
 *  is a 5-button strip below the cloud, not a settings panel. */
export function layoutStrategyLabel(strategy: LumenLayoutStrategy): string {
  switch (strategy) {
    case 'time':
      return 'Cloud';
    case 'grid':
      return 'Grid';
    case 'spiral':
      return 'Spiral';
    case 'wall':
      return 'Wall';
    case 'mood':
      return 'Mood';
  }
}

/** Long-form description shown as a tooltip / sr-only label. */
export function layoutStrategyDescription(strategy: LumenLayoutStrategy): string {
  switch (strategy) {
    case 'time':
      return 'Photos drift in a 3D cloud, X = capture time, Y = rating.';
    case 'grid':
      return 'Photos snap to a uniform 2D grid.';
    case 'spiral':
      return 'Photos arrange on a golden-angle spiral.';
    case 'wall':
      return 'Photos line up on a flat wall facing the camera.';
    case 'mood':
      return 'Photos cluster by mood (AI clustering lands later — currently mirrors Cloud).';
  }
}

/** Uniform 2D grid centred on the origin. Z stays 0 so the grid reads
 *  as a single flat surface; row count auto-derives from the photo
 *  count so the grid stays roughly square (sqrt-N pattern). */
export function layoutByGrid(
  photos: ReadonlyArray<LumenPhotoLike>,
  config: LumenLayoutConfig = DEFAULT_LUMEN_LAYOUT,
): ReadonlyArray<LumenPlaneLayout> {
  if (photos.length === 0) return [];
  const total = photos.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt(total)));
  const rows = Math.max(1, Math.ceil(total / cols));
  const xStep = config.axisLengthX / Math.max(1, cols);
  const yStep = config.axisLengthY / Math.max(1, rows);
  // Centre the grid: half a step in to avoid hugging the rail.
  const xOrigin = -config.axisLengthX / 2 + xStep / 2;
  const yOrigin = config.axisLengthY / 2 - yStep / 2;
  return photos.map((p, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      id: p.id,
      position: [xOrigin + col * xStep, yOrigin - row * yStep, 0] as const,
      size: config.planeBaseSize,
      url: p.url,
    };
  });
}

/** Golden-angle spiral on a flat disc. Each photo sits at angle
 *  i × goldenAngle, radius proportional to √i so the area density
 *  stays uniform (classic phyllotaxis pattern). */
export function layoutBySpiral(
  photos: ReadonlyArray<LumenPhotoLike>,
  config: LumenLayoutConfig = DEFAULT_LUMEN_LAYOUT,
): ReadonlyArray<LumenPlaneLayout> {
  if (photos.length === 0) return [];
  // Golden angle in radians: π × (3 − √5) ≈ 137.508°.
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const total = photos.length;
  // Scale so the outermost photo lands near axisLengthY/2 (matches the
  // visual size of the time-cloud layout).
  const maxRadius = Math.min(config.axisLengthX, config.axisLengthY) / 2;
  return photos.map((p, i) => {
    const r = maxRadius * Math.sqrt((i + 0.5) / Math.max(1, total));
    const angle = i * goldenAngle;
    return {
      id: p.id,
      position: [Math.cos(angle) * r, Math.sin(angle) * r, 0] as const,
      size: config.planeBaseSize,
      url: p.url,
    };
  });
}

/** Flat wall in front of the camera (z = 0), photos arranged into a
 *  centred row × column block but TIGHTER than the grid — half the
 *  spacing so the wall reads as "stacked closely" vs grid's airy feel. */
export function layoutByWall(
  photos: ReadonlyArray<LumenPhotoLike>,
  config: LumenLayoutConfig = DEFAULT_LUMEN_LAYOUT,
): ReadonlyArray<LumenPlaneLayout> {
  if (photos.length === 0) return [];
  const total = photos.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt(total)));
  const rows = Math.max(1, Math.ceil(total / cols));
  // Wall uses 70% of the axis length so frames touch, like in a salon.
  const xStep = (config.axisLengthX * 0.7) / Math.max(1, cols);
  const yStep = (config.axisLengthY * 0.7) / Math.max(1, rows);
  const xOrigin = -((cols - 1) * xStep) / 2;
  const yOrigin = ((rows - 1) * yStep) / 2;
  return photos.map((p, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    // Slight z jitter (smaller than time-cloud) so the wall has a
    // little tooth — a flat plane of 50 frames feels CGI-fake.
    const z = jitterZFor(p.id, config.jitterZ * 0.25);
    return {
      id: p.id,
      position: [xOrigin + col * xStep, yOrigin - row * yStep, z] as const,
      size: config.planeBaseSize,
      url: p.url,
    };
  });
}

/** AE410 mood strategy stub. Falls back to the time-cloud layout
 *  until the CLIP embedding endpoint ships. Exported separately so
 *  the upgrade path is a single function-body swap without touching
 *  the strategy dispatcher signature. */
export function layoutByMoodStub(
  photos: ReadonlyArray<LumenPhotoLike>,
  config: LumenLayoutConfig = DEFAULT_LUMEN_LAYOUT,
): ReadonlyArray<LumenPlaneLayout> {
  return layoutPhotoCloud(photos, config);
}

/** Strategy dispatcher. The scene calls this with the user-selected
 *  strategy + the photo list and renders the resulting plane array. */
export function applyLayoutStrategy(
  strategy: LumenLayoutStrategy,
  photos: ReadonlyArray<LumenPhotoLike>,
  config: LumenLayoutConfig = DEFAULT_LUMEN_LAYOUT,
): ReadonlyArray<LumenPlaneLayout> {
  switch (strategy) {
    case 'time':
      return layoutPhotoCloud(photos, config);
    case 'grid':
      return layoutByGrid(photos, config);
    case 'spiral':
      return layoutBySpiral(photos, config);
    case 'wall':
      return layoutByWall(photos, config);
    case 'mood':
      return layoutByMoodStub(photos, config);
  }
}

/** True when the strategy is one we know how to actually render (i.e.
 *  doesn't depend on a backend that hasn't shipped yet). Used to gate
 *  the "(AI)" label on the mood option in the arrange menu. */
export function isStrategyImplemented(strategy: LumenLayoutStrategy): boolean {
  return strategy !== 'mood';
}
