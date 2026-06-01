/**
 * AE530 — sigil render layout (pure geometry).
 *
 * `buildSigilGrid` (AE390) produces the boolean `SigilGrid` for the
 * Continuum handoff sigil. Rendering it to pixels — whether as SVG on
 * the web canvas or as Skia rects in the Phase 4 native canvas — is the
 * same square-cell layout maths on both sides. This module is that
 * shared maths: it takes a `SigilGrid` and emits one positioned
 * `SigilCellRect` per cell so the renderer only has to draw squares.
 *
 * Pure: no React, no DOM, no Skia. Both `@app/aether-canvas` (web R3F /
 * SVG) and `@app/aether-canvas/native` (RN Skia) consume the identical
 * layout so a sigil looks byte-identical across devices during handoff.
 *
 * Layout contract (row-major, top-left origin):
 *   row r, col c → x = c * (cellPx + gapPx), y = r * (cellPx + gapPx)
 * Every cell — filled or not — gets a rect; the renderer chooses how to
 * paint `filled === false` (usually skip / paper colour). Emitting empty
 * cells too keeps the consumer branch-free and lets hit-testing line up
 * with the grid 1:1.
 */

import type { SigilGrid } from './continuum-sigil';

/** One positioned cell of a rendered sigil grid. */
export interface SigilCellRect {
  /** Top-left x in px. */
  readonly x: number;
  /** Top-left y in px. */
  readonly y: number;
  /** Cell edge in px (== cellPx). */
  readonly size: number;
  /** `grid[row][col]` — whether this cell is filled. */
  readonly filled: boolean;
}

/** Lay a `SigilGrid` out into positioned square cells.
 *
 *  Row `r`, col `c` maps to
 *    x = c * (cellPx + gapPx)
 *    y = r * (cellPx + gapPx)
 *  Returns one `SigilCellRect` per cell in **row-major** order
 *  (all of row 0 left-to-right, then row 1, …). Empty grid → `[]`.
 *
 *  `gapPx` defaults to 0 (cells touch edge-to-edge). The `size` of every
 *  rect is `cellPx` — the gap is the spacing *between* cells, never part
 *  of a cell. Rows are walked independently so a ragged grid (rows of
 *  differing length) still lays each cell out at its own column index.
 */
export function sigilCellRects(
  grid: SigilGrid,
  cellPx: number,
  gapPx: number = 0,
): SigilCellRect[] {
  if (grid.length === 0) return [];
  const stride = cellPx + gapPx;
  const rects: SigilCellRect[] = [];
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    if (row === undefined) continue;
    for (let c = 0; c < row.length; c++) {
      rects.push({
        x: c * stride,
        y: r * stride,
        size: cellPx,
        filled: row[c] === true,
      });
    }
  }
  return rects;
}

/** Total pixel edge of a square sigil:
 *    cols * cellPx + (cols - 1) * gapPx
 *  where `cols` is taken from the **first row's** length. Empty grid → 0.
 *
 *  Gaps sit only *between* cells, so N cells have N−1 gaps. A single
 *  column therefore measures exactly `cellPx` (no trailing gap).
 *  `gapPx` defaults to 0.
 */
export function sigilPixelSize(grid: SigilGrid, cellPx: number, gapPx: number = 0): number {
  if (grid.length === 0) return 0;
  const firstRow = grid[0];
  const cols = firstRow === undefined ? 0 : firstRow.length;
  if (cols === 0) return 0;
  return cols * cellPx + (cols - 1) * gapPx;
}
