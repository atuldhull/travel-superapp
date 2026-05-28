/**
 * @app/aether-motion / easing — non-spring curves.
 *
 * Used where spring physics don't fit: scrub-driven scroll progress,
 * audio envelope curves, particle field LUT lookups. App code prefers
 * `spring` tokens; reach for `easing` only when the motion is paramatized
 * by something other than physics (time-bound, scroll-bound).
 */

/** Cubic-bezier curve as the 4-tuple WAAPI / CSS / RN accept. */
export type CubicBezier = readonly [number, number, number, number];

/** The Aether default — gentle ease-in-out, matched to the `book` spring
 *  feel so mixing them across a single surface doesn't jar. */
export const standard: CubicBezier = [0.42, 0, 0.18, 1];

/** Enter — eases out of "off-screen / hidden" without a starting jolt.
 *  Used by sheet enter, surface-level reveal. */
export const enter: CubicBezier = [0, 0, 0.18, 1];

/** Exit — eases into "off-screen / dismissed" with a deliberate snap
 *  at the start; matches the way a piece of paper leaves your fingers. */
export const exit: CubicBezier = [0.42, 0, 1, 1];

/** Audio envelope — short attack, long release. Matches a struck
 *  nylon string. Consumed by `@app/aether-core` audio engine. */
export const audioEnvelope: CubicBezier = [0.1, 0.85, 0.4, 1];

/** Particle drift — almost linear, with a slight pull toward the
 *  centre. Used by Drift / Compass ambient particles. */
export const drift: CubicBezier = [0.4, 0.1, 0.6, 0.9];

export const easings = { standard, enter, exit, audioEnvelope, drift } as const;
export type EasingName = keyof typeof easings;
