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
  // AE442 — edge cases pushing the helper through saturated / single-channel / degenerate inputs.
  it('pure black returns the input unchanged (no scaling possible)', () => {
    expect(boostHexColor('#000000', 2)).toBe('#000000');
  });
  it('pure white stays at #FFFFFF (already saturated)', () => {
    expect(boostHexColor('#FFFFFF', 2)).toBe('#FFFFFF');
  });
  it('single-channel red boosts close to pure red when factor saturates the max channel', () => {
    // 0x7F * 2 = 0xFE (factor 2 caps below the 255/127 ratio).
    expect(boostHexColor('#7F0000', 2)).toBe('#FE0000');
    // 0x0F * (255/15) = 0xFF (factor >> the implicit max ratio).
    expect(boostHexColor('#0F0000', 100)).toBe('#FF0000');
  });
  it('factor < 1 attenuates (no clamp at 1.0 floor)', () => {
    const dim = boostHexColor('#FF0000', 0.5);
    const n = parseInt(dim.slice(1), 16);
    const r = (n >> 16) & 0xff;
    expect(r).toBeLessThan(0xff);
  });
  it('trims surrounding whitespace before parsing', () => {
    expect(boostHexColor('  #4060A0  ', 1)).toMatch(/^#[0-9A-F]{6}$/);
  });
  it('mixed case hex is parsed normally', () => {
    expect(boostHexColor('#aBcDeF', 1)).toMatch(/^#[0-9A-F]{6}$/);
  });
  it('output is always uppercase even with lowercase input', () => {
    const out = boostHexColor('#a0a0a0', 1.5);
    expect(out).toBe(out.toUpperCase());
  });
  it('hex too short returns the input unchanged', () => {
    expect(boostHexColor('#fff', 1.5)).toBe('#fff');
  });
  it('hex too long returns the input unchanged', () => {
    expect(boostHexColor('#FFFFFFFF', 1.5)).toBe('#FFFFFFFF');
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

// AE466 — boundary conditions for the Echo feed gesture + day/week
// cliff + lowercase-hex paths. The swipe direction has a documented
// vertical-preference on ties; the day-7 boundary flips d → w; the
// boostHexColor lowercase path needs an exact-output assertion so we
// catch any future drift in either the parse step (which already
// accepts /[0-9a-f]{6}/i) or the toUpperCase() formatting step.
describe('echoSwipeDirectionFromDelta (AE466 exact-tie pixel deltas)', () => {
  it('positive tie (dx === dy, both above noise) → down (vertical preference, dy > 0)', () => {
    expect(echoSwipeDirectionFromDelta(30, 30)).toBe('down');
    expect(echoSwipeDirectionFromDelta(100, 100)).toBe('down');
  });
  it('negative tie (dx === dy, both negative above noise) → up (vertical preference, dy < 0)', () => {
    expect(echoSwipeDirectionFromDelta(-30, -30)).toBe('up');
    expect(echoSwipeDirectionFromDelta(-100, -100)).toBe('up');
  });
  it('mixed-sign tie with positive dx + negative dy → up', () => {
    expect(echoSwipeDirectionFromDelta(30, -30)).toBe('up');
  });
  it('mixed-sign tie with negative dx + positive dy → down', () => {
    expect(echoSwipeDirectionFromDelta(-30, 30)).toBe('down');
  });
  it('exactly at the noise threshold on one axis with no movement on the other → null', () => {
    expect(echoSwipeDirectionFromDelta(ECHO_SWIPE_NOISE_PX - 1, 0)).toBeNull();
    expect(echoSwipeDirectionFromDelta(0, ECHO_SWIPE_NOISE_PX - 1)).toBeNull();
  });
  it('exactly at the noise threshold on both axes → fires (>= absX check is inclusive of the equal axis)', () => {
    // both abs equal ECHO_SWIPE_NOISE_PX, so neither axis is under the floor; vertical wins on tie.
    expect(echoSwipeDirectionFromDelta(ECHO_SWIPE_NOISE_PX, ECHO_SWIPE_NOISE_PX)).toBe('down');
  });
});

describe('formatEchoPostedAt (AE466 day-7 boundary cliff)', () => {
  const now = new Date('2026-06-01T12:00:00.000Z').getTime();
  it('day 6 (144h ago) → "6d" (still days bucket)', () => {
    expect(formatEchoPostedAt('2026-05-26T12:00:00.000Z', now)).toBe('6d');
  });
  it('day 7 (168h ago) → "1w" (flips to weeks bucket)', () => {
    expect(formatEchoPostedAt('2026-05-25T12:00:00.000Z', now)).toBe('1w');
  });
  it('just under day 7 (167h ago) → still "6d"', () => {
    expect(formatEchoPostedAt('2026-05-25T13:00:00.000Z', now)).toBe('6d');
  });
  it('just over day 7 (169h ago) → "1w"', () => {
    expect(formatEchoPostedAt('2026-05-25T11:00:00.000Z', now)).toBe('1w');
  });
});

describe('boostHexColor (AE466 lowercase hex path)', () => {
  it('lowercase "#4060a0" with factor 2 produces the same output as uppercase "#4060A0"', () => {
    expect(boostHexColor('#4060a0', 2)).toBe(boostHexColor('#4060A0', 2));
  });
  it('lowercase "#4060a0" with factor 2 → "#6699FF" (max-channel saturates, scale = 255/160 = 1.59375)', () => {
    // 0x40 * 1.59375 = 102 = 0x66; 0x60 * 1.59375 = 153 = 0x99; 0xA0 * 1.59375 = 255 = 0xFF.
    expect(boostHexColor('#4060a0', 2)).toBe('#6699FF');
  });
  it('lowercase output without leading # is still parsed + output uppercase with #', () => {
    expect(boostHexColor('4060a0', 2)).toBe('#6699FF');
  });
  it('lowercase + uppercase + mixed-case inputs all produce the same uppercase output', () => {
    const a = boostHexColor('#4060a0', 2);
    const b = boostHexColor('#4060A0', 2);
    const c = boostHexColor('#4060Aa'.replace('Aa', 'a0'), 2);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a).toBe(a.toUpperCase());
  });
});
