/**
 * AE530 - canvas-shared behavioural spec for the sigil render layout
 * helpers (`sigilCellRects` + `sigilPixelSize`).
 *
 * Covers:
 *   - empty grid -> [] and 0
 *   - 1x1 grid (single cell, both filled + empty)
 *   - 2x2 grid with mixed filled values: x/y positions, filled flags,
 *     row-major ordering
 *   - gapPx applied to x/y stride (and gapPx default 0)
 *   - sigilPixelSize for 1-col / 3-col / with-gap
 *   - integration with the real buildSigilGrid: lay out a built grid,
 *     assert rect count == total cell count and filled-rect count ==
 *     sigilFilledCount.
 *
 * Imports ONLY from the package barrel (`../src`) so these helpers stay
 * shippable to any consumer that re-exports `@app/aether-canvas-shared`.
 */

import {
  DEFAULT_SIGIL_SIZE,
  buildSigilGrid,
  sigilCellRects,
  sigilFilledCount,
  sigilPixelSize,
} from '../src';
import type { SigilCellRect, SigilGrid } from '../src';

const grid = (rows: boolean[][]): SigilGrid => rows;

describe('AE530 - sigilCellRects empty grid', () => {
  it('returns [] for a zero-row grid', () => {
    expect(sigilCellRects([], 10)).toEqual([]);
  });

  it('returns [] regardless of cellPx / gapPx on an empty grid', () => {
    expect(sigilCellRects([], 0)).toEqual([]);
    expect(sigilCellRects([], 99, 7)).toEqual([]);
  });
});

describe('AE530 - sigilCellRects 1x1 grid', () => {
  it('emits exactly one rect for a single filled cell', () => {
    const rects = sigilCellRects(grid([[true]]), 10);
    expect(rects).toHaveLength(1);
  });

  it('positions the single cell at the origin with size == cellPx', () => {
    const [only] = sigilCellRects(grid([[true]]), 16);
    expect(only).toEqual<SigilCellRect>({ x: 0, y: 0, size: 16, filled: true });
  });

  it('carries filled=false for a single empty cell', () => {
    const [only] = sigilCellRects(grid([[false]]), 16);
    expect(only?.filled).toBe(false);
    expect(only?.x).toBe(0);
    expect(only?.y).toBe(0);
  });

  it('ignores gapPx for a 1x1 grid (no neighbours to space from)', () => {
    const [only] = sigilCellRects(grid([[true]]), 12, 4);
    expect(only).toEqual<SigilCellRect>({ x: 0, y: 0, size: 12, filled: true });
  });
});

describe('AE530 - sigilCellRects 2x2 mixed grid (no gap)', () => {
  // [ true,  false ]
  // [ false, true  ]
  const g = grid([
    [true, false],
    [false, true],
  ]);

  it('emits one rect per cell (4 total)', () => {
    expect(sigilCellRects(g, 10)).toHaveLength(4);
  });

  it('walks cells in row-major order (row 0 cols then row 1 cols)', () => {
    const rects = sigilCellRects(g, 10);
    expect(rects.map((r) => [r.x, r.y])).toEqual([
      [0, 0],
      [10, 0],
      [0, 10],
      [10, 10],
    ]);
  });

  it('maps filled flags to the right cells in row-major order', () => {
    const rects = sigilCellRects(g, 10);
    expect(rects.map((r) => r.filled)).toEqual([true, false, false, true]);
  });

  it('positions (row=0,col=0) at (0,0)', () => {
    const [tl] = sigilCellRects(g, 10);
    expect(tl).toEqual<SigilCellRect>({ x: 0, y: 0, size: 10, filled: true });
  });

  it('positions (row=0,col=1) at (cellPx,0)', () => {
    const tr = sigilCellRects(g, 10)[1];
    expect(tr).toEqual<SigilCellRect>({ x: 10, y: 0, size: 10, filled: false });
  });

  it('positions (row=1,col=0) at (0,cellPx)', () => {
    const bl = sigilCellRects(g, 10)[2];
    expect(bl).toEqual<SigilCellRect>({ x: 0, y: 10, size: 10, filled: false });
  });

  it('positions (row=1,col=1) at (cellPx,cellPx)', () => {
    const br = sigilCellRects(g, 10)[3];
    expect(br).toEqual<SigilCellRect>({ x: 10, y: 10, size: 10, filled: true });
  });

  it('gives every rect size == cellPx', () => {
    const rects = sigilCellRects(g, 10);
    expect(rects.every((r) => r.size === 10)).toBe(true);
  });
});

describe('AE530 - sigilCellRects gapPx applied', () => {
  const g = grid([
    [true, true],
    [true, true],
  ]);

  it('adds gapPx into the stride for x and y (cellPx=10, gap=2 -> stride 12)', () => {
    const rects = sigilCellRects(g, 10, 2);
    expect(rects.map((r) => [r.x, r.y])).toEqual([
      [0, 0],
      [12, 0],
      [0, 12],
      [12, 12],
    ]);
  });

  it('keeps each rect size at cellPx, never cellPx+gapPx', () => {
    const rects = sigilCellRects(g, 10, 2);
    expect(rects.every((r) => r.size === 10)).toBe(true);
  });

  it('defaults gapPx to 0 when omitted (cells touch edge-to-edge)', () => {
    const withImplicit = sigilCellRects(g, 10);
    const withExplicit = sigilCellRects(g, 10, 0);
    expect(withImplicit).toEqual(withExplicit);
  });

  it('the first cell stays at the origin regardless of gap', () => {
    const [first] = sigilCellRects(g, 10, 8);
    expect(first?.x).toBe(0);
    expect(first?.y).toBe(0);
  });
});

describe('AE530 - sigilCellRects ragged rows', () => {
  it('lays each cell at its own column index even when rows differ in length', () => {
    const g = grid([[true], [false, true, false]]);
    const rects = sigilCellRects(g, 10);
    expect(rects).toHaveLength(4);
    expect(rects.map((r) => [r.x, r.y])).toEqual([
      [0, 0],
      [0, 10],
      [10, 10],
      [20, 10],
    ]);
  });

  it('treats a row of length 0 as contributing no rects', () => {
    const g = grid([[true, true], []]);
    const rects = sigilCellRects(g, 10);
    expect(rects).toHaveLength(2);
    expect(rects.map((r) => r.y)).toEqual([0, 0]);
  });
});

describe('AE530 - sigilPixelSize empty grid', () => {
  it('returns 0 for a zero-row grid', () => {
    expect(sigilPixelSize([], 10)).toBe(0);
  });

  it('returns 0 when the first row has zero columns', () => {
    expect(sigilPixelSize(grid([[]]), 10, 3)).toBe(0);
  });
});

describe('AE530 - sigilPixelSize single column', () => {
  it('measures exactly cellPx for a 1-col grid (no trailing gap)', () => {
    expect(sigilPixelSize(grid([[true]]), 16)).toBe(16);
  });

  it('still measures cellPx for a 1-col grid even with a gap set', () => {
    expect(sigilPixelSize(grid([[true]]), 16, 5)).toBe(16);
  });
});

describe('AE530 - sigilPixelSize multi column', () => {
  it('3 cols no gap -> 3 * cellPx', () => {
    expect(sigilPixelSize(grid([[true, false, true]]), 10)).toBe(30);
  });

  it('3 cols with gap -> cols*cellPx + (cols-1)*gapPx', () => {
    // 3*10 + 2*4 = 38
    expect(sigilPixelSize(grid([[true, false, true]]), 10, 4)).toBe(38);
  });

  it('takes the column count from the first row only', () => {
    const g = grid([
      [true, true], // 2 cols -> drives the size
      [true, true, true, true], // longer trailing rows ignored
    ]);
    expect(sigilPixelSize(g, 10, 2)).toBe(22); // 2*10 + 1*2
  });

  it('defaults gapPx to 0 when omitted', () => {
    const g = grid([[true, false, true, false]]);
    expect(sigilPixelSize(g, 10)).toBe(sigilPixelSize(g, 10, 0));
  });
});

describe('AE530 - integration with buildSigilGrid', () => {
  it('rect count equals total cell count (filled + empty) of the built grid', () => {
    const g = buildSigilGrid('continuum://atlas?leh');
    const totalCells = g.reduce((sum, row) => sum + row.length, 0);
    expect(sigilCellRects(g, 8).length).toBe(totalCells);
  });

  it('default-size grid lays out 21*21 = 441 rects', () => {
    const g = buildSigilGrid('continuum://atlas?leh');
    expect(g.length).toBe(DEFAULT_SIGIL_SIZE);
    expect(sigilCellRects(g, 8)).toHaveLength(DEFAULT_SIGIL_SIZE * DEFAULT_SIGIL_SIZE);
  });

  it('filled-rect count equals sigilFilledCount of the built grid', () => {
    const g = buildSigilGrid('continuum://vault?leh-jacket');
    const filledRects = sigilCellRects(g, 8).filter((r) => r.filled).length;
    expect(filledRects).toBe(sigilFilledCount(g));
  });

  it('empty-rect count equals total minus filled', () => {
    const g = buildSigilGrid('continuum://journey?42');
    const rects = sigilCellRects(g, 8);
    const empties = rects.filter((r) => !r.filled).length;
    expect(empties).toBe(rects.length - sigilFilledCount(g));
  });

  it('sigilPixelSize of the default grid is size*cellPx + (size-1)*gap', () => {
    const g = buildSigilGrid('continuum://atlas?leh');
    // 21*8 + 20*1 = 188
    expect(sigilPixelSize(g, 8, 1)).toBe(DEFAULT_SIGIL_SIZE * 8 + (DEFAULT_SIGIL_SIZE - 1) * 1);
  });

  it('lays out a small (sub-finder) built grid 1:1 with its cells', () => {
    const g = buildSigilGrid('x', 5); // sub-9 -> pure-noise 5x5
    const rects = sigilCellRects(g, 4);
    expect(rects).toHaveLength(25);
    expect(rects.filter((r) => r.filled).length).toBe(sigilFilledCount(g));
  });

  it('the last rect of the default grid sits at the bottom-right cell', () => {
    const g = buildSigilGrid('continuum://atlas?leh');
    const rects = sigilCellRects(g, 8, 1);
    const last = rects[rects.length - 1];
    // bottom-right cell: row 20, col 20, stride 9
    expect(last?.x).toBe((DEFAULT_SIGIL_SIZE - 1) * 9);
    expect(last?.y).toBe((DEFAULT_SIGIL_SIZE - 1) * 9);
    expect(last?.size).toBe(8);
  });
});
