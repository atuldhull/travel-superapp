/** Vitest specs for AE419 Echo layout helpers. */
import { describe, expect, it } from 'vitest';
import {
  ECHO_CARD_HEIGHT,
  ECHO_CARD_SPACING_Y,
  ECHO_CARD_WIDTH,
  echoCardOpacity,
  echoCardScale,
  echoCardVisible,
  echoCardY,
  visibleEchoSlots,
} from '../../src/components/aether/phase3/echo-layout';

describe('ECHO_CARD_* constants (pure)', () => {
  it('spacing > height so cards do not overlap', () => {
    expect(ECHO_CARD_SPACING_Y).toBeGreaterThan(ECHO_CARD_HEIGHT);
  });
  it('width > height (landscape default)', () => {
    expect(ECHO_CARD_WIDTH).toBeGreaterThan(ECHO_CARD_HEIGHT);
  });
});

describe('echoCardY (pure)', () => {
  it('active card sits at y=0', () => {
    expect(echoCardY(2, 2)).toBe(0);
  });
  it('cards above active (lower index) sit at positive y', () => {
    expect(echoCardY(0, 2, 1)).toBe(2);
    expect(echoCardY(1, 2, 1)).toBe(1);
  });
  it('cards below active (higher index) sit at negative y', () => {
    expect(echoCardY(3, 2, 1)).toBe(-1);
    expect(echoCardY(4, 2, 1)).toBe(-2);
  });
  it('honours custom spacing', () => {
    expect(echoCardY(0, 1, 4)).toBe(4);
  });
});

describe('echoCardScale (pure)', () => {
  it('active card → 1.0', () => {
    expect(echoCardScale(3, 3)).toBe(1);
  });
  it('immediate neighbours → 0.86', () => {
    expect(echoCardScale(2, 3)).toBeCloseTo(0.86, 5);
    expect(echoCardScale(4, 3)).toBeCloseTo(0.86, 5);
  });
  it('further-out cards → 0.7', () => {
    expect(echoCardScale(1, 3)).toBeCloseTo(0.7, 5);
    expect(echoCardScale(5, 3)).toBeCloseTo(0.7, 5);
  });
});

describe('echoCardOpacity (pure)', () => {
  it('active → 1.0', () => {
    expect(echoCardOpacity(3, 3)).toBe(1);
  });
  it('neighbours → 0.42', () => {
    expect(echoCardOpacity(2, 3)).toBeCloseTo(0.42, 5);
    expect(echoCardOpacity(4, 3)).toBeCloseTo(0.42, 5);
  });
  it('offset 2 → 0.18', () => {
    expect(echoCardOpacity(1, 3)).toBeCloseTo(0.18, 5);
    expect(echoCardOpacity(5, 3)).toBeCloseTo(0.18, 5);
  });
  it('offset 3+ → 0 (not rendered)', () => {
    expect(echoCardOpacity(0, 3)).toBe(0);
    expect(echoCardOpacity(6, 3)).toBe(0);
  });
});

describe('echoCardVisible (pure)', () => {
  it('true within offset 2', () => {
    expect(echoCardVisible(2, 3)).toBe(true);
    expect(echoCardVisible(3, 3)).toBe(true);
    expect(echoCardVisible(4, 3)).toBe(true);
    expect(echoCardVisible(1, 3)).toBe(true);
    expect(echoCardVisible(5, 3)).toBe(true);
  });
  it('false past offset 2', () => {
    expect(echoCardVisible(0, 3)).toBe(false);
    expect(echoCardVisible(6, 3)).toBe(false);
  });
});

describe('visibleEchoSlots (pure)', () => {
  const items = [
    { id: 'a' },
    { id: 'b' },
    { id: 'c' },
    { id: 'd' },
    { id: 'e' },
    { id: 'f' },
    { id: 'g' },
  ] as const;
  it('returns items within window around the active index', () => {
    const slots = visibleEchoSlots(items, 3);
    expect(slots.map((s) => s.item.id)).toEqual(['b', 'c', 'd', 'e', 'f']);
  });
  it('returns indices alongside items', () => {
    const slots = visibleEchoSlots(items, 3);
    expect(slots.map((s) => s.index)).toEqual([1, 2, 3, 4, 5]);
  });
  it('clamps at the head', () => {
    const slots = visibleEchoSlots(items, 0);
    expect(slots.map((s) => s.item.id)).toEqual(['a', 'b', 'c']);
  });
  it('clamps at the tail', () => {
    const slots = visibleEchoSlots(items, 6);
    expect(slots.map((s) => s.item.id)).toEqual(['e', 'f', 'g']);
  });
  it('empty items → empty result', () => {
    expect(visibleEchoSlots([], 0)).toEqual([]);
  });
});

// AE466 — boundary conditions for the echo card stack: offsets 3/4/5
// on scale + opacity (the "peripheral cards we still render but barely"
// vs the "don't render at all" cliff), and visibleEchoSlots under the
// three degenerate inputs the AE420 swipe controller can hand us
// (single-item feed, empty feed, out-of-range active index from a fast
// double-swipe near the boundary, and a defensive negative activeIndex).
describe('echoCardScale (AE466 offsets 3+)', () => {
  it('offset 3 → 0.7 (peripheral plateau)', () => {
    expect(echoCardScale(0, 3)).toBeCloseTo(0.7, 5);
    expect(echoCardScale(6, 3)).toBeCloseTo(0.7, 5);
  });
  it('offset 4 → 0.7 (same peripheral plateau)', () => {
    expect(echoCardScale(7, 3)).toBeCloseTo(0.7, 5);
    expect(echoCardScale(0, 4)).toBeCloseTo(0.7, 5);
  });
  it('offset 5 → 0.7', () => {
    expect(echoCardScale(0, 5)).toBeCloseTo(0.7, 5);
    expect(echoCardScale(10, 5)).toBeCloseTo(0.7, 5);
  });
  it('huge offset stays at the 0.7 plateau (does not collapse to 0)', () => {
    expect(echoCardScale(0, 1000)).toBeCloseTo(0.7, 5);
  });
});

describe('echoCardOpacity (AE466 offsets 3+ stay at 0)', () => {
  it('offset 3 → 0', () => {
    expect(echoCardOpacity(0, 3)).toBe(0);
    expect(echoCardOpacity(6, 3)).toBe(0);
  });
  it('offset 4 → 0', () => {
    expect(echoCardOpacity(7, 3)).toBe(0);
    expect(echoCardOpacity(0, 4)).toBe(0);
  });
  it('offset 5 → 0', () => {
    expect(echoCardOpacity(0, 5)).toBe(0);
    expect(echoCardOpacity(10, 5)).toBe(0);
  });
  it('huge offset stays at 0 (does not flip negative)', () => {
    expect(echoCardOpacity(0, 1000)).toBe(0);
  });
});

describe('visibleEchoSlots (AE466 boundary inputs)', () => {
  it('single-item feed at activeIndex 0 → that one item', () => {
    const slots = visibleEchoSlots([{ id: 'only' }], 0);
    expect(slots).toHaveLength(1);
    expect(slots[0]).toEqual({ item: { id: 'only' }, index: 0 });
  });
  it('single-item feed at activeIndex 0 → active card has scale 1 + opacity 1', () => {
    const slots = visibleEchoSlots([{ id: 'only' }], 0);
    expect(echoCardScale(slots[0].index, 0)).toBe(1);
    expect(echoCardOpacity(slots[0].index, 0)).toBe(1);
  });
  it('empty feed at activeIndex 0 → empty result (already tested elsewhere; restated for AE466 contract)', () => {
    expect(visibleEchoSlots([], 0)).toEqual([]);
  });
  it('empty feed at any activeIndex → empty result (never throws)', () => {
    expect(visibleEchoSlots([], 5)).toEqual([]);
    expect(visibleEchoSlots([], -1)).toEqual([]);
    expect(visibleEchoSlots([], 999)).toEqual([]);
  });
  it('activeIndex >= items.length → returns no slots (every offset > 2)', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as const;
    expect(visibleEchoSlots(items, 10)).toEqual([]);
    expect(visibleEchoSlots(items, 100)).toEqual([]);
  });
  it('activeIndex one past the end → last two items remain visible (offsets 1, 2)', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as const;
    const slots = visibleEchoSlots(items, 3);
    expect(slots.map((s) => s.item.id)).toEqual(['b', 'c']);
  });
  it('negative activeIndex → first two items remain visible (defensive)', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] as const;
    const slots = visibleEchoSlots(items, -1);
    expect(slots.map((s) => s.item.id)).toEqual(['a', 'b']);
  });
  it('deeply-negative activeIndex → empty (every offset > 2)', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as const;
    expect(visibleEchoSlots(items, -10)).toEqual([]);
  });
});
