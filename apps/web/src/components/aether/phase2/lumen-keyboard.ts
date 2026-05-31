/**
 * AE403 — pure helpers for Lumen keyboard navigation.
 *
 * Arrow keys step through the photo cloud. The X axis (capture time)
 * maps to Left / Right; the Y axis (rating) to Up / Down. Picking
 * "the next plane in this direction" honest-first-cut: sort by x for
 * horizontal, by y for vertical, then walk the index.
 *
 * Pure — no React, no DOM. The hook in the scene maps `KeyboardEvent`
 * to one of these and writes the result to LumenSelectionProvider.
 */
import type { LumenPlaneLayout } from './lumen-cloud';

/** Arrow direction the consumer cares about. */
export type LumenArrowDirection = 'left' | 'right' | 'up' | 'down';

/** Pick the next plane in a direction relative to `currentId`. When
 *  `currentId` is null, picks the leftmost (Left/Right) or top-rated
 *  (Up/Down) plane to seed the focus. Returns null when there are no
 *  planes or the walk would step off the end. */
export function nextPhotoInDirection(
  planes: ReadonlyArray<LumenPlaneLayout>,
  currentId: string | null,
  dir: LumenArrowDirection,
): string | null {
  if (planes.length === 0) return null;
  // Sort by the relevant axis. Stable on ties.
  const horizontal = dir === 'left' || dir === 'right';
  const sorted = [...planes].sort((a, b) => {
    if (horizontal) {
      const dx = a.position[0] - b.position[0];
      if (dx !== 0) return dx;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    }
    // Up/Down — sort by Y descending so up = previous index.
    const dy = b.position[1] - a.position[1];
    if (dy !== 0) return dy;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  if (currentId === null) {
    // Seed: leftmost / topmost is sorted[0].
    return sorted[0]?.id ?? null;
  }
  const idx = sorted.findIndex((p) => p.id === currentId);
  if (idx === -1) return sorted[0]?.id ?? null;
  // Right + Down → next index; Left + Up → previous index.
  const step = dir === 'right' || dir === 'down' ? 1 : -1;
  const target = idx + step;
  if (target < 0 || target >= sorted.length) return null;
  return sorted[target]?.id ?? null;
}

/** Map a raw KeyboardEvent.key to a LumenArrowDirection. Returns null
 *  for keys we don't handle so the caller doesn't need to filter. */
export function arrowDirectionFromKey(key: string): LumenArrowDirection | null {
  if (key === 'ArrowLeft') return 'left';
  if (key === 'ArrowRight') return 'right';
  if (key === 'ArrowUp') return 'up';
  if (key === 'ArrowDown') return 'down';
  return null;
}

/** Format a focused-photo announcement for the aria-live announcer.
 *
 *  Phase 1 first cut just says "Photo <N> of <total>" since we don't
 *  yet have captions on `MemoryBookAssetSummaryDto`. Future slice can
 *  thread `caption` through and produce richer text. */
export function lumenFocusAnnouncement(
  focusedId: string | null,
  planes: ReadonlyArray<LumenPlaneLayout>,
): string {
  if (focusedId === null) return 'Cloud overview';
  // Use the time-sorted index so the announcement matches how the
  // arrow keys walk the cloud.
  const sorted = [...planes].sort((a, b) => a.position[0] - b.position[0]);
  const idx = sorted.findIndex((p) => p.id === focusedId);
  if (idx === -1) return 'Cloud overview';
  return `Photo ${idx + 1} of ${planes.length}`;
}
