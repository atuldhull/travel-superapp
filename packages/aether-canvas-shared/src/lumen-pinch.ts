/**
 * AE409 — pure helpers for Lumen pinch-zoom focus transitions.
 *
 * Trackpad pinch (and Ctrl+wheel) on every modern browser surfaces as
 * a `wheel` event with `ctrlKey: true`. The deltaY sign carries the
 * gesture direction:
 *
 *   • deltaY < 0  → fingers spread apart → "zoom in" → focus a photo
 *   • deltaY > 0  → fingers come together → "zoom out" → clear focus
 *
 * Pure — no React, no DOM. The scene's wheel handler maps the
 * KeyboardEvent / WheelEvent to one of these intents and writes the
 * resolved focused id through `LumenSelectionProvider`.
 */
import type { LumenPlaneLayout } from './lumen-cloud';

/** Pinch-derived intent. `null` means "no change" — the scene's wheel
 *  handler short-circuits and doesn't touch focus state. */
export type LumenPinchIntent = 'in' | 'out' | null;

/** Minimum absolute deltaY to count as a deliberate pinch. Sub-1px
 *  trackpad noise is ignored so a still hand doesn't churn focus. */
export const PINCH_DELTA_THRESHOLD = 1;

/** Minimal shape we need from a wheel event. The browser's WheelEvent
 *  is structurally compatible, but declaring our own keeps the helpers
 *  framework-agnostic + testable without jsdom. */
export interface LumenPinchWheelEvent {
  readonly deltaY: number;
  readonly ctrlKey: boolean;
}

/** Detect pinch intent from a wheel-like event. Only events with
 *  `ctrlKey: true` count — that's how every browser flags trackpad
 *  pinch (and Ctrl+scroll wheel, which we treat as the same intent). */
export function wheelToPinchIntent(event: LumenPinchWheelEvent): LumenPinchIntent {
  if (!event.ctrlKey) return null;
  if (event.deltaY < -PINCH_DELTA_THRESHOLD) return 'in';
  if (event.deltaY > PINCH_DELTA_THRESHOLD) return 'out';
  return null;
}

/** Find the plane whose X/Y position is nearest to (cx, cy). Returns
 *  the id of the nearest plane, or null when the list is empty. Used
 *  to pick a focus target when pinching in from cloud-overview mode —
 *  the centre of the cloud is at (0, 0), so the most central photo
 *  reads as the natural "first thing the user wants to inspect". */
export function nearestPlaneToCenter(
  planes: ReadonlyArray<LumenPlaneLayout>,
  cx: number = 0,
  cy: number = 0,
): string | null {
  if (planes.length === 0) return null;
  let bestId: string | null = null;
  let bestDistSq = Number.POSITIVE_INFINITY;
  for (const p of planes) {
    const dx = p.position[0] - cx;
    const dy = p.position[1] - cy;
    const distSq = dx * dx + dy * dy;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestId = p.id;
    }
  }
  return bestId;
}

/** Resolve the next focused id for a pinch intent. Returns
 *  `undefined` when no focus change should happen (so the caller can
 *  skip the setter call); `null` to clear focus; or a string id to
 *  enter focus.
 *
 *  Transition table:
 *    intent  focus    → result
 *    null    *        → undefined (no change)
 *    'in'    null     → nearest-to-centre plane (enter focus)
 *    'in'    set      → undefined (already focused; no further zoom)
 *    'out'   null     → undefined (already at widest)
 *    'out'   set      → null (clear focus) */
export function nextFocusForPinch(
  intent: LumenPinchIntent,
  focusedId: string | null,
  planes: ReadonlyArray<LumenPlaneLayout>,
): string | null | undefined {
  if (intent === null) return undefined;
  if (intent === 'in') {
    if (focusedId !== null) return undefined;
    return nearestPlaneToCenter(planes);
  }
  // intent === 'out'
  if (focusedId === null) return undefined;
  return null;
}
