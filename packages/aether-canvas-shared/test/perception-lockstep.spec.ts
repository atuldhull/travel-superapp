/**
 * AE596 — lock-step guard between the canvas-shared perception mirror
 * (`perception-frame.ts`) and the aether-core source of truth
 * (`perception.tsx`).
 *
 * The two type copies are kept identical BY HAND — canvas-shared can't
 * import aether-core's copy without dragging React types into native
 * consumers (see the file headers). Nothing enforced that until now: the
 * most likely future edit (adding a `Gesture`) would silently diverge.
 *
 * This is the enforcement. The `import type` is erased at runtime (no
 * React is loaded) and a test file never reaches apps/mobile's bundle, so
 * importing aether-core's TYPES here is safe (a sibling package does the
 * same — aether-canvas-native/test imports `type SurfaceId`). If either
 * copy drifts, the `MutuallyAssignable` assertions below fail to compile.
 */
import type {
  GazePoint as CoreGazePoint,
  Gesture as CoreGesture,
  GestureEvent as CoreGestureEvent,
  PerceptionState as CorePerceptionState,
} from '@app/aether-core';
import {
  mockPerceptionStateAt,
  type GazePoint,
  type Gesture,
  type GestureEvent,
  type PerceptionState,
} from '../src';

/** `true` iff A and B are mutually assignable (structurally identical);
 *  `never` otherwise, which makes `const _: ... = true` fail to compile.
 *  Tuple-wrapped so unions don't distribute. */
type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

const gazeInSync: MutuallyAssignable<GazePoint, CoreGazePoint> = true;
const gestureInSync: MutuallyAssignable<Gesture, CoreGesture> = true;
const eventInSync: MutuallyAssignable<GestureEvent, CoreGestureEvent> = true;
const stateInSync: MutuallyAssignable<PerceptionState, CorePerceptionState> = true;

describe('AE596 — perception lock-step with @app/aether-core', () => {
  it('the canvas-shared mirror is structurally identical to the core contract', () => {
    // The four consts above are compile-time assertions; referencing them
    // here keeps them "used" and pins the result at runtime too.
    expect([gazeInSync, gestureInSync, eventInSync, stateInSync]).toEqual([true, true, true, true]);
  });

  it('a canvas-shared mock frame satisfies the core PerceptionState shape', () => {
    // Compiles only if the mock's PerceptionState is assignable to the
    // core copy the <PerceptionProvider state> prop expects.
    const frame: CorePerceptionState = mockPerceptionStateAt(0);
    expect(frame.active).toBe(true);
  });
});
