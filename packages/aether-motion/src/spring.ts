/**
 * @app/aether-motion / spring — Warm Italian physics tokens.
 *
 * Locked 2026-05-28: stiffness `k=120`, damping `d=18`, mass `m=1`.
 * Generous settle, soft overshoot — the leather-bound-journal feel.
 *
 * Every Aether animation uses a named spring from this file. New springs
 * land here first via PR + an ADR — never inline `useSpring({ tension })`.
 * The brand is the spring; the spring is the brand.
 *
 * Naming uses object metaphors (book, page, breath) not engineering
 * terms (fast, slow) — physics tokens age out of "fast" but a `book`
 * spring always feels like a book.
 */

/** Pure spring physics — consumable by react-spring, framer-motion,
 *  Reanimated, or hand-rolled requestAnimationFrame loops. */
export interface SpringPhysics {
  /** Stiffness; higher = faster, less travel. */
  readonly stiffness: number;
  /** Damping; higher = less bounce. */
  readonly damping: number;
  /** Mass; default 1 — bump only for deliberate weight (sheet drag, card lift). */
  readonly mass: number;
  /** Velocity at rest threshold — when |v| < this AND |x - target| < restDelta, spring is "settled". */
  readonly restVelocity: number;
  /** Position-at-rest threshold. */
  readonly restDelta: number;
}

/** The base Warm Italian spring. All other springs are deliberate
 *  deviations with documented why. */
export const book: SpringPhysics = {
  stiffness: 120,
  damping: 18,
  mass: 1,
  restVelocity: 0.01,
  restDelta: 0.01,
};

/** Snappier — for hover lifts, focus rings, button press release.
 *  Critically damped so it never bounces (interaction feedback shouldn't
 *  wobble). */
export const tap: SpringPhysics = {
  stiffness: 280,
  damping: 30,
  mass: 1,
  restVelocity: 0.05,
  restDelta: 0.05,
};

/** Slower + heavier — for sheets, drawers, modal dismissal. The user
 *  feels they're moving a real object. */
export const sheet: SpringPhysics = {
  stiffness: 80,
  damping: 22,
  mass: 1.4,
  restVelocity: 0.005,
  restDelta: 0.005,
};

/** Almost-imperceptible — for ambient motion (sun position, particle
 *  drift, audio waveform). Should never compete for attention. */
export const breath: SpringPhysics = {
  stiffness: 30,
  damping: 16,
  mass: 1,
  restVelocity: 0.001,
  restDelta: 0.001,
};

/** Page-turn — Lumen memory book signature, deliberately playful with
 *  a single overshoot to mimic paper releasing. */
export const page: SpringPhysics = {
  stiffness: 140,
  damping: 16,
  mass: 1.1,
  restVelocity: 0.01,
  restDelta: 0.01,
};

/** All named springs, addressable by string key — useful for
 *  Storybook controls + ADR diffs. */
export const springs = { book, tap, sheet, breath, page } as const;

export type SpringName = keyof typeof springs;

/** Reduced-motion variant — used when the user enables prefers-reduced-motion.
 *  Snaps to target in ~80ms with no spring physics at all. Components consume
 *  this through the theme provider, never directly. */
export const reducedMotion = {
  /** ms to ease linearly to target; no spring math. */
  durationMs: 80,
  /** linear easing curve as a cubic-bezier for symmetry with the easing token. */
  curve: [0, 0, 1, 1] as readonly [number, number, number, number],
} as const;

/** Stagger constants — how long to wait between items in a list.
 *  Aether stagger is intentionally slower than React-style "100ms each"
 *  because the audio system needs to space the per-item ticks. */
export const stagger = {
  /** List items entering (search results, feed). */
  list: 60,
  /** Cards entering (memory book pages, place cards). */
  card: 90,
  /** Hero / surface-level reveal — Drift particles, Atlas building bloom. */
  hero: 140,
} as const;
