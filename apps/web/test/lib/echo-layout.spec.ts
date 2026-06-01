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
