/**
 * AE390 — visual "handoff sigil" pure helper.
 *
 * The Continuum bar popover (per docs/aether/02-surfaces.md §10) shows the
 * deep-link URL the receiving device can open + a visual identifier so
 * the sender can confirm at a glance "yes, this is my Atlas, not someone
 * else's". Phase 4 will replace this with a real QR code (architecture
 * doc reserves `@app/aether/continuum` for it). Phase 1 ships a
 * deterministic 21×21 boolean grid that's:
 *
 *   - **visually QR-evocative** (3 corner finder patterns + dense body)
 *     so users recognise it as "the handoff thing"
 *   - **stable per state** (same seed → same grid, byte-for-byte)
 *   - **fast** (no Reed-Solomon; pure mulberry32 PRNG + bit flips)
 *   - **NOT scannable** by a QR reader — the real handoff is the deep
 *     link displayed alongside it. The architecture doc is explicit:
 *     "QR with deep-link fallback" → Phase 1 ships the fallback.
 *
 * Pure: no DOM, no React. The Continuum bar component renders the
 * boolean grid as SVG.
 */

/** Default sigil dimensions — matches QR version 1 (21×21) on purpose so
 *  the swap to a real QR encoder in Phase 4 is a drop-in replacement. */
export const DEFAULT_SIGIL_SIZE = 21;

/** A boolean grid where `true` = filled cell. Row-major: `grid[y][x]`. */
export type SigilGrid = ReadonlyArray<ReadonlyArray<boolean>>;

/** mulberry32 — same PRNG used elsewhere in the app for determinism
 *  (AE299 makeRng). Inlined here so the helper doesn't drag in a wider
 *  dep graph (this file is meant to stay tiny + fast). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function rng(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic 32-bit hash of a string. FNV-1a — fast, good
 *  distribution for short ASCII inputs like our Continuum URLs. */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Build the sigil grid for a given seed.
 *
 *  Layout (size=21):
 *    • Three 7×7 finder patterns at corners (top-left, top-right,
 *      bottom-left) drawn solid-filled with the classic QR ring shape.
 *    • Two 1-cell timing strips connecting the finder patterns along
 *      row 6 and column 6 (alternating filled / empty).
 *    • Remaining cells filled deterministically from a mulberry32 seeded
 *      with the FNV-1a hash of `seed`. Per-cell threshold is 0.5 so the
 *      grid averages ~50% density (visually busy, QR-evocative).
 *
 *  Smaller sizes degrade gracefully — the finder patterns still claim
 *  3 corners; the body shrinks. Sizes below 9 skip finders entirely
 *  (no room) and fall back to pure noise.
 */
export function buildSigilGrid(seed: string, size: number = DEFAULT_SIGIL_SIZE): SigilGrid {
  if (!Number.isFinite(size) || size < 1) {
    return [];
  }
  const sz = Math.max(1, Math.floor(size));
  const rng = mulberry32(hashSeed(seed));
  // Initialise with noise so finder-pattern code can selectively overwrite.
  const grid: boolean[][] = [];
  for (let y = 0; y < sz; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < sz; x++) {
      row.push(rng() > 0.5);
    }
    grid.push(row);
  }
  // Finder patterns require ≥9 cells per side (7 finder + 1 spacing + 1).
  if (sz < 9) return grid;
  drawFinder(grid, 0, 0);
  drawFinder(grid, sz - 7, 0);
  drawFinder(grid, 0, sz - 7);
  // Timing strips between top-left and top-right (row 6) and between
  // top-left and bottom-left (column 6) — alternating filled / empty.
  for (let x = 8; x < sz - 8; x++) {
    setCell(grid, x, 6, x % 2 === 0);
  }
  for (let y = 8; y < sz - 8; y++) {
    setCell(grid, 6, y, y % 2 === 0);
  }
  // Spacer rows/cols around each finder so the pattern reads cleanly.
  clearSpacer(grid, 0, 7, 8, 1); // bottom of top-left finder
  clearSpacer(grid, 7, 0, 1, 8); // right of top-left finder
  clearSpacer(grid, sz - 8, 7, 8, 1); // bottom of top-right finder
  clearSpacer(grid, sz - 8, 0, 1, 7); // left of top-right finder
  clearSpacer(grid, 0, sz - 8, 7, 1); // top of bottom-left finder
  clearSpacer(grid, 7, sz - 8, 1, 8); // right of bottom-left finder
  return grid;
}

/** Count `true` cells — handy for tests asserting density bounds. */
export function sigilFilledCount(grid: SigilGrid): number {
  let n = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell) n++;
    }
  }
  return n;
}

/** Two sigils that are byte-for-byte equal? (Used by tests + the
 *  Continuum receiver to confirm the sender's identity at a glance.) */
export function sigilEquals(a: SigilGrid, b: SigilGrid): boolean {
  if (a.length !== b.length) return false;
  for (let y = 0; y < a.length; y++) {
    const ra = a[y];
    const rb = b[y];
    if (ra === undefined || rb === undefined) return false;
    if (ra.length !== rb.length) return false;
    for (let x = 0; x < ra.length; x++) {
      if (ra[x] !== rb[x]) return false;
    }
  }
  return true;
}

/** Classic QR finder: 7×7 outer black ring, 1-cell white gap, 3×3 black
 *  centre. Drawn at top-left corner `(ox, oy)`. */
function drawFinder(grid: boolean[][], ox: number, oy: number): void {
  for (let dy = 0; dy < 7; dy++) {
    for (let dx = 0; dx < 7; dx++) {
      const onEdge = dx === 0 || dx === 6 || dy === 0 || dy === 6;
      const inGap =
        (dx === 1 || dx === 5) && dy >= 1 && dy <= 5
          ? true
          : (dy === 1 || dy === 5) && dx >= 1 && dx <= 5
            ? true
            : false;
      const inCentre = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
      setCell(grid, ox + dx, oy + dy, onEdge || inCentre || (!inGap && false));
    }
  }
}

/** Clear a w×h rectangle (set every cell to `false`). Bounds-safe. */
function clearSpacer(grid: boolean[][], ox: number, oy: number, w: number, h: number): void {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      setCell(grid, ox + dx, oy + dy, false);
    }
  }
}

function setCell(grid: boolean[][], x: number, y: number, v: boolean): void {
  if (y < 0 || y >= grid.length) return;
  const row = grid[y];
  if (row === undefined || x < 0 || x >= row.length) return;
  row[x] = v;
}
