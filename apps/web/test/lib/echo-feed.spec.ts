/** Vitest specs for AE418 Echo feed helpers. */
import { describe, expect, it } from 'vitest';
import {
  ECHO_SWIPE_NOISE_PX,
  boostHexColor,
  echoActionForSwipe,
  echoPaletteFromDominantColor,
  echoSwipeDirectionFromDelta,
  formatEchoPostedAt,
  nextEchoIndex,
} from '../../src/components/aether/phase3/echo-feed';

describe('ECHO_SWIPE_NOISE_PX (pure)', () => {
  it('is large enough to ignore micro-touches', () => {
    expect(ECHO_SWIPE_NOISE_PX).toBeGreaterThanOrEqual(8);
    expect(ECHO_SWIPE_NOISE_PX).toBeLessThan(60);
  });
});

describe('echoSwipeDirectionFromDelta (pure)', () => {
  it('returns null when below the noise threshold', () => {
    expect(echoSwipeDirectionFromDelta(0, 0)).toBeNull();
    expect(echoSwipeDirectionFromDelta(10, 5)).toBeNull();
  });
  it('vertical dominance picks up/down by sign of dy', () => {
    expect(echoSwipeDirectionFromDelta(0, -100)).toBe('up');
    expect(echoSwipeDirectionFromDelta(0, 100)).toBe('down');
  });
  it('horizontal dominance picks left/right by sign of dx', () => {
    expect(echoSwipeDirectionFromDelta(-100, 0)).toBe('left');
    expect(echoSwipeDirectionFromDelta(100, 0)).toBe('right');
  });
  it('ties prefer vertical (TikTok-style scroll lock)', () => {
    expect(echoSwipeDirectionFromDelta(100, -100)).toBe('up');
  });
  it('honours custom noise threshold', () => {
    expect(echoSwipeDirectionFromDelta(20, 0, 50)).toBeNull();
    expect(echoSwipeDirectionFromDelta(60, 0, 50)).toBe('right');
  });
  it('NaN/Infinity in either axis collapses to null', () => {
    expect(echoSwipeDirectionFromDelta(Number.NaN, 0)).toBeNull();
    expect(echoSwipeDirectionFromDelta(0, Number.NaN)).toBeNull();
  });
});

describe('echoActionForSwipe (pure)', () => {
  it('up → save-place', () => {
    expect(echoActionForSwipe('up')).toBe('save-place');
  });
  it('right → follow-traveller', () => {
    expect(echoActionForSwipe('right')).toBe('follow-traveller');
  });
  it('down → next (walk feed)', () => {
    expect(echoActionForSwipe('down')).toBe('next');
  });
  it('left → prev (walk back)', () => {
    expect(echoActionForSwipe('left')).toBe('prev');
  });
  it('null direction → null action', () => {
    expect(echoActionForSwipe(null)).toBeNull();
  });
});

describe('nextEchoIndex (pure)', () => {
  it('advances on next', () => {
    expect(nextEchoIndex(0, 5, 'next')).toBe(1);
  });
  it('clamps at the end', () => {
    expect(nextEchoIndex(4, 5, 'next')).toBe(4);
  });
  it('rewinds on prev', () => {
    expect(nextEchoIndex(2, 5, 'prev')).toBe(1);
  });
  it('clamps at the start', () => {
    expect(nextEchoIndex(0, 5, 'prev')).toBe(0);
  });
  it('save/follow/plan do not move the cursor', () => {
    expect(nextEchoIndex(2, 5, 'save-place')).toBe(2);
    expect(nextEchoIndex(2, 5, 'follow-traveller')).toBe(2);
    expect(nextEchoIndex(2, 5, 'plan-like-this')).toBe(2);
  });
  it('null action returns the current index', () => {
    expect(nextEchoIndex(2, 5, null)).toBe(2);
  });
  it('empty feed → 0', () => {
    expect(nextEchoIndex(0, 0, 'next')).toBe(0);
  });
});

describe('boostHexColor (pure)', () => {
  it('null → palette accent fallback', () => {
    expect(boostHexColor(null)).toBe('#C2614A');
  });
  it('invalid hex → returns the input unchanged', () => {
    expect(boostHexColor('not-a-colour')).toBe('not-a-colour');
  });
  it('saturates a muted hex toward its brightest channel', () => {
    // muted blue 0x4060A0 boosts toward 0x?? max 0xA0 → scale factor 255/160 ≈ 1.594
    const boosted = boostHexColor('#4060A0', 2);
    expect(boosted).toMatch(/^#[0-9A-F]{6}$/);
    // the boosted hex's max channel should hit 0xFF.
    const n = parseInt(boosted.slice(1), 16);
    const r = (n >> 16) & 0xff;
    const g = (n >> 8) & 0xff;
    const b = n & 0xff;
    expect(Math.max(r, g, b)).toBe(0xff);
  });
  it('honours factor as an upper bound (does not over-amplify)', () => {
    const out = boostHexColor('#7F7F7F', 1.2);
    const n = parseInt(out.slice(1), 16);
    expect((n >> 16) & 0xff).toBeCloseTo(0x7f * 1.2, 0);
  });
  it('handles 6-char lowercase + 7-char with leading #', () => {
    expect(boostHexColor('4060a0', 1.5)).toMatch(/^#[0-9A-F]{6}$/);
    expect(boostHexColor('#4060A0', 1.5)).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe('echoPaletteFromDominantColor (pure)', () => {
  it('null → Warm Italian baseline', () => {
    const p = echoPaletteFromDominantColor(null);
    expect(p).toEqual(['#1A0F09', '#F2E8D5', '#C2614A', '#E8B777', '#6E7B5C']);
  });
  it('valid hex → accent + glow tinted from input, baseline kept for the rest', () => {
    const p = echoPaletteFromDominantColor('#5C84B4');
    expect(p[0]).toBe('#1A0F09');
    expect(p[1]).toBe('#F2E8D5');
    expect(p[2]).not.toBe('#C2614A');
    expect(p[3]).not.toBe('#E8B777');
    expect(p[4]).toBe('#6E7B5C');
  });
  it('garbage input falls back to baseline', () => {
    const p = echoPaletteFromDominantColor('not-a-colour');
    expect(p).toEqual(['#1A0F09', '#F2E8D5', '#C2614A', '#E8B777', '#6E7B5C']);
  });
});

describe('formatEchoPostedAt (pure)', () => {
  const now = new Date('2026-06-01T12:00:00.000Z').getTime();
  it('null / empty → empty string', () => {
    expect(formatEchoPostedAt(null)).toBe('');
    expect(formatEchoPostedAt('')).toBe('');
  });
  it('< 1 min → "just now"', () => {
    expect(formatEchoPostedAt('2026-06-01T11:59:30.000Z', now)).toBe('just now');
  });
  it('minutes', () => {
    expect(formatEchoPostedAt('2026-06-01T11:45:00.000Z', now)).toBe('15m');
  });
  it('hours', () => {
    expect(formatEchoPostedAt('2026-06-01T08:00:00.000Z', now)).toBe('4h');
  });
  it('days', () => {
    expect(formatEchoPostedAt('2026-05-30T12:00:00.000Z', now)).toBe('2d');
  });
  it('weeks', () => {
    expect(formatEchoPostedAt('2026-05-15T12:00:00.000Z', now)).toBe('2w');
  });
  it('invalid timestamp → empty string', () => {
    expect(formatEchoPostedAt('not-an-iso', now)).toBe('');
  });
});
