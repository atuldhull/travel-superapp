/**
 * AE535 — Drift ambient-field + sun-disk math (pure).
 *
 * The Drift surface (docs/aether/02-surfaces.md section 1) is a slow
 * field of dust motes drifting around a terracotta sun disk. The web
 * R3F `<AmbientField>` + `<SunDisk>` generate their geometry from this
 * same math; the Phase 4 native R3F scene
 * (`apps/mobile/src/aether/drift-scene.tsx`) consumes it verbatim so
 * the field is laid out identically on both renderers.
 *
 * Pure: no React, no Three, no DOM. Deterministic — `ambientFieldPositions`
 * uses a mulberry32 PRNG seeded by a fixed constant so the same
 * `(count, bounds, seed)` always yields the same cloud (tests can pin
 * exact coordinates; two devices render the same field).
 */

/** Half-extents of the ambient field box on each axis (world units).
 *  Motes are scattered within `[-x, +x] x [-y, +y] x [-z, +z]`. */
export interface DriftBounds {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Default field box — matches the web AE377 `bounds={[12, 8, 10]}`
 *  (those are full extents; halved here per-axis). */
export const DEFAULT_DRIFT_BOUNDS: DriftBounds = Object.freeze({ x: 6, y: 4, z: 5 });

/** Default mote count — matches the web AE377 `<AmbientField count={600}>`. */
export const DEFAULT_DRIFT_MOTE_COUNT = 600;

/** Default seed for the field PRNG. Fixed so the cloud is identical
 *  across renders + devices. */
export const DEFAULT_DRIFT_SEED = 0x9e3779b9;

/** mulberry32 — a tiny, fast, well-distributed 32-bit PRNG. Returns a
 *  function that yields successive floats in [0, 1). Deterministic for
 *  a given seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic dust-mote positions for the Drift ambient field.
 *
 *  Returns `count` `[x, y, z]` tuples scattered uniformly within
 *  `[-bounds.x, +bounds.x]` etc. The same `(count, bounds, seed)`
 *  always yields the same array (mulberry32). `count <= 0` → `[]`. */
export function ambientFieldPositions(
  count: number = DEFAULT_DRIFT_MOTE_COUNT,
  bounds: DriftBounds = DEFAULT_DRIFT_BOUNDS,
  seed: number = DEFAULT_DRIFT_SEED,
): Array<[number, number, number]> {
  if (!Number.isFinite(count) || count <= 0) return [];
  const n = Math.floor(count);
  const rand = mulberry32(seed);
  const out: Array<[number, number, number]> = [];
  for (let i = 0; i < n; i += 1) {
    const x = (rand() * 2 - 1) * bounds.x;
    const y = (rand() * 2 - 1) * bounds.y;
    const z = (rand() * 2 - 1) * bounds.z;
    out.push([x, y, z]);
  }
  return out;
}

/** Flatten `ambientFieldPositions` into a single `Float32Array` of
 *  `[x0,y0,z0, x1,y1,z1, ...]` — the exact shape a Three.js
 *  `BufferAttribute` wants for a points cloud, so the native scene can
 *  pass it straight into `setAttribute('position', ...)`. */
export function ambientFieldPositionArray(
  count: number = DEFAULT_DRIFT_MOTE_COUNT,
  bounds: DriftBounds = DEFAULT_DRIFT_BOUNDS,
  seed: number = DEFAULT_DRIFT_SEED,
): Float32Array {
  const tuples = ambientFieldPositions(count, bounds, seed);
  const arr = new Float32Array(tuples.length * 3);
  for (let i = 0; i < tuples.length; i += 1) {
    const t = tuples[i];
    if (t === undefined) continue;
    arr[i * 3] = t[0];
    arr[i * 3 + 1] = t[1];
    arr[i * 3 + 2] = t[2];
  }
  return arr;
}

/** Default sun-disk rotation speed (radians / second). Slow — one full
 *  turn every ~50s — so the disk reads as "alive but calm". */
export const DEFAULT_SUN_RADIANS_PER_SECOND = (2 * Math.PI) / 50;

/** Sun-disk rotation angle (radians) at elapsed time `tMs`, folded into
 *  `[0, 2π)`. Pure function of time so the scene's `useFrame` can drive
 *  it from its own clock + tests can pin exact angles. `tMs` non-finite
 *  → 0. */
export function sunDiskRotation(
  tMs: number,
  radiansPerSecond: number = DEFAULT_SUN_RADIANS_PER_SECOND,
): number {
  if (!Number.isFinite(tMs)) return 0;
  const raw = (tMs / 1000) * radiansPerSecond;
  const twoPi = 2 * Math.PI;
  const wrapped = raw % twoPi;
  return wrapped < 0 ? wrapped + twoPi : wrapped;
}
