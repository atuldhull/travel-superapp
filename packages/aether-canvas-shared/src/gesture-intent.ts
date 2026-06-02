/**
 * `gesture-intent` — map a recognised gesture to the abstract intent a
 * surface acts on (Phase 5, AE593).
 *
 * Surfaces shouldn't hard-code raw gesture names; they react to intents
 * so the gesture→intent table can evolve (and the MLP can later emit
 * intents directly) without touching every consumer. Pure lookup +
 * confidence gating.
 */
import { isConfidentGesture, type Gesture, type GestureEvent } from './perception-frame';

/** What a gesture *means* to a surface. `none` = ignore. */
export type GestureIntent = 'none' | 'select' | 'dismiss' | 'focus' | 'summon';

/** Canonical gesture → intent map. pinch grabs (select), open palm pushes
 *  away (dismiss), point aims (focus), wave hails (summon Genie/Pulse). */
const INTENT_BY_GESTURE: Record<Gesture, GestureIntent> = {
  pinch: 'select',
  'open-palm': 'dismiss',
  point: 'focus',
  wave: 'summon',
};

/** The intent for a gesture. Unknown gestures (a widened telemetry value
 *  cast to `Gesture`) map to `none`. */
export function gestureIntent(gesture: Gesture): GestureIntent {
  return INTENT_BY_GESTURE[gesture] ?? 'none';
}

/**
 * The intent for a gesture EVENT, gated by confidence: a null or
 * low-confidence event yields `none` so a surface never acts on a
 * flickery detection.
 */
export function intentForEvent(event: GestureEvent | null, minConfidence?: number): GestureIntent {
  if (!isConfidentGesture(event, minConfidence)) return 'none';
  return gestureIntent(event.gesture);
}
