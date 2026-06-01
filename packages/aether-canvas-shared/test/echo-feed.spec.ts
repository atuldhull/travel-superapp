/**
 * AE503 - canvas-shared own behavioural spec for `echo-feed`.
 *
 * Pins the AE418 Echo feed helpers: swipe-direction decoding (noise
 * floor + axis tiebreak + non-finite guard), swipe-to-action mapping
 * with null no-op, nextEchoIndex clamping at both ends, boostHexColor
 * saturation behaviour (null fallback, malformed pass-through, all-
 * zero short-circuit, factor cap), the 5-slot palette derivation, and
 * the six-stage formatEchoPostedAt relative-time table.
 */
import {
  ECHO_SWIPE_NOISE_PX,
  boostHexColor,
  echoActionForSwipe,
  echoPaletteFromDominantColor,
  echoSwipeDirectionFromDelta,
  formatEchoPostedAt,
  nextEchoIndex,
  type EchoAction,
  type EchoSwipeDirection,
} from '../src';

describe('AE503 - ECHO_SWIPE_NOISE_PX constant', () => {
  it('is a positive sub-100px noise floor', () => {
    expect(ECHO_SWIPE_NOISE_PX).toBeGreaterThan(0);
    expect(ECHO_SWIPE_NOISE_PX).toBeLessThan(100);
  });
});

describe('AE503 - echoSwipeDirectionFromDelta', () => {
  it('returns null when both deltas sit below the noise floor', () => {
    expect(echoSwipeDirectionFromDelta(0, 0)).toBe(null);
    expect(echoSwipeDirectionFromDelta(ECHO_SWIPE_NOISE_PX - 1, ECHO_SWIPE_NOISE_PX - 1)).toBe(
      null,
    );
  });
  it('returns null when either delta is non-finite (NaN or Infinity)', () => {
    expect(echoSwipeDirectionFromDelta(Number.NaN, 100)).toBe(null);
    expect(echoSwipeDirectionFromDelta(100, Number.NaN)).toBe(null);
    expect(echoSwipeDirectionFromDelta(Number.POSITIVE_INFINITY, 0)).toBe(null);
    expect(echoSwipeDirectionFromDelta(0, Number.NEGATIVE_INFINITY)).toBe(null);
  });
  it('returns "up" for a sufficiently negative vertical delta on the y-axis', () => {
    expect(echoSwipeDirectionFromDelta(0, -ECHO_SWIPE_NOISE_PX - 1)).toBe('up');
    expect(echoSwipeDirectionFromDelta(5, -200)).toBe('up');
  });
  it('returns "down" for a sufficiently positive vertical delta on the y-axis', () => {
    expect(echoSwipeDirectionFromDelta(0, ECHO_SWIPE_NOISE_PX + 1)).toBe('down');
    expect(echoSwipeDirectionFromDelta(5, 200)).toBe('down');
  });
  it('returns "left" when horizontal delta dominates and is negative', () => {
    expect(echoSwipeDirectionFromDelta(-ECHO_SWIPE_NOISE_PX - 1, 0)).toBe('left');
    expect(echoSwipeDirectionFromDelta(-200, 5)).toBe('left');
  });
  it('returns "right" when horizontal delta dominates and is positive', () => {
    expect(echoSwipeDirectionFromDelta(ECHO_SWIPE_NOISE_PX + 1, 0)).toBe('right');
    expect(echoSwipeDirectionFromDelta(200, 5)).toBe('right');
  });
  it('breaks an exact-tie (absY equals absX) by preferring the vertical axis', () => {
    expect(echoSwipeDirectionFromDelta(50, -50)).toBe('up');
    expect(echoSwipeDirectionFromDelta(50, 50)).toBe('down');
  });
  it('honours a custom noisePx argument when supplied', () => {
    expect(echoSwipeDirectionFromDelta(10, 10, 50)).toBe(null);
    expect(echoSwipeDirectionFromDelta(0, 60, 50)).toBe('down');
  });
});

describe('AE503 - echoActionForSwipe mapping', () => {
  it('maps up to save-place', () => {
    expect(echoActionForSwipe('up')).toBe('save-place');
  });
  it('maps right to follow-traveller', () => {
    expect(echoActionForSwipe('right')).toBe('follow-traveller');
  });
  it('maps down to next so the feed walks forward', () => {
    expect(echoActionForSwipe('down')).toBe('next');
  });
  it('maps left to prev so the feed walks backward', () => {
    expect(echoActionForSwipe('left')).toBe('prev');
  });
  it('returns null when direction is null (no gesture)', () => {
    expect(echoActionForSwipe(null)).toBe(null);
  });
  it('covers every EchoSwipeDirection variant with a non-undefined result', () => {
    const all: EchoSwipeDirection[] = ['up', 'down', 'left', 'right', null];
    for (const d of all) {
      const out = echoActionForSwipe(d);
      // either an EchoAction or null - never undefined
      expect(out === null || typeof out === 'string').toBe(true);
    }
  });
});

describe('AE503 - nextEchoIndex clamping', () => {
  it('returns 0 when total is 0 regardless of action', () => {
    expect(nextEchoIndex(0, 0, 'next')).toBe(0);
    expect(nextEchoIndex(5, 0, 'prev')).toBe(0);
    expect(nextEchoIndex(0, 0, null)).toBe(0);
  });
  it('advances by one on "next" when there is room', () => {
    expect(nextEchoIndex(0, 5, 'next')).toBe(1);
    expect(nextEchoIndex(3, 5, 'next')).toBe(4);
  });
  it('clamps at the last index on "next" rather than wrapping', () => {
    expect(nextEchoIndex(4, 5, 'next')).toBe(4);
    expect(nextEchoIndex(99, 5, 'next')).toBe(4);
  });
  it('rewinds by one on "prev" when there is room', () => {
    expect(nextEchoIndex(2, 5, 'prev')).toBe(1);
    expect(nextEchoIndex(1, 5, 'prev')).toBe(0);
  });
  it('clamps at zero on "prev" rather than wrapping', () => {
    expect(nextEchoIndex(0, 5, 'prev')).toBe(0);
  });
  it('passes the index through for non-walking actions + null', () => {
    expect(nextEchoIndex(2, 5, 'save-place')).toBe(2);
    expect(nextEchoIndex(2, 5, 'follow-traveller')).toBe(2);
    expect(nextEchoIndex(2, 5, 'plan-like-this' as EchoAction)).toBe(2);
    expect(nextEchoIndex(2, 5, null)).toBe(2);
  });
});

describe('AE503 - boostHexColor', () => {
  it('returns the Warm Italian terracotta when input is null', () => {
    expect(boostHexColor(null)).toBe('#C2614A');
  });
  it('returns the original string unchanged when input is malformed', () => {
    expect(boostHexColor('not-a-hex')).toBe('not-a-hex');
    expect(boostHexColor('#12345')).toBe('#12345');
    expect(boostHexColor('#GGGGGG')).toBe('#GGGGGG');
  });
  it('returns the original string when the input is the all-zero hex', () => {
    expect(boostHexColor('#000000')).toBe('#000000');
  });
  it('accepts hex with or without leading # and is case-insensitive', () => {
    const withHash = boostHexColor('#3366aa', 1);
    const noHash = boostHexColor('3366AA', 1);
    expect(withHash).toBe(noHash);
    expect(withHash).toMatch(/^#[0-9A-F]{6}$/);
  });
  it('trims surrounding whitespace before parsing', () => {
    expect(boostHexColor('  #336699  ', 1)).toMatch(/^#[0-9A-F]{6}$/);
  });
  it('caps the boost so no channel exceeds 255', () => {
    // pure-red input at any factor should still be #FF0000 after clamp
    expect(boostHexColor('#FF0000', 5)).toBe('#FF0000');
  });
  it('emits a 6-char upper-case hex string with a leading #', () => {
    const out = boostHexColor('#336699');
    expect(out).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe('AE503 - echoPaletteFromDominantColor', () => {
  it('returns a tuple of exactly 5 hex colours', () => {
    const out = echoPaletteFromDominantColor('#336699');
    expect(out).toHaveLength(5);
    for (const c of out) {
      expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
  it('returns the locked Warm Italian baseline when the dominant colour is null', () => {
    expect(echoPaletteFromDominantColor(null)).toEqual([
      '#1A0F09',
      '#F2E8D5',
      '#C2614A',
      '#E8B777',
      '#6E7B5C',
    ]);
  });
  it('falls back to the baseline when the dominant colour is malformed', () => {
    expect(echoPaletteFromDominantColor('not-a-hex')).toEqual([
      '#1A0F09',
      '#F2E8D5',
      '#C2614A',
      '#E8B777',
      '#6E7B5C',
    ]);
  });
  it('preserves the baseline ink + surface + support slots when re-deriving from a colour', () => {
    const out = echoPaletteFromDominantColor('#336699');
    expect(out[0]).toBe('#1A0F09');
    expect(out[1]).toBe('#F2E8D5');
    expect(out[4]).toBe('#6E7B5C');
  });
  it('re-derives accent + glow slots from the dominant colour', () => {
    const out = echoPaletteFromDominantColor('#336699');
    expect(out[2]).toBe(boostHexColor('#336699', 1.2));
    expect(out[3]).toBe(boostHexColor('#336699', 1.45));
  });
});

describe('AE503 - formatEchoPostedAt relative-time table', () => {
  const NOW = new Date('2026-06-01T12:00:00Z').getTime();

  it('returns an empty string for null + empty input', () => {
    expect(formatEchoPostedAt(null, NOW)).toBe('');
    expect(formatEchoPostedAt('', NOW)).toBe('');
  });
  it('returns an empty string for an unparseable timestamp', () => {
    expect(formatEchoPostedAt('not-a-date', NOW)).toBe('');
  });
  it('returns "just now" for deltas below 60 seconds', () => {
    const t = new Date(NOW - 30_000).toISOString();
    expect(formatEchoPostedAt(t, NOW)).toMatch(/just now/i);
  });
  it('returns an m-suffixed string for sub-hour deltas', () => {
    const t = new Date(NOW - 5 * 60_000).toISOString();
    expect(formatEchoPostedAt(t, NOW)).toBe('5m');
  });
  it('returns an h-suffixed string for sub-day deltas', () => {
    const t = new Date(NOW - 3 * 3_600_000).toISOString();
    expect(formatEchoPostedAt(t, NOW)).toBe('3h');
  });
  it('returns a d-suffixed string for sub-week deltas', () => {
    const t = new Date(NOW - 2 * 86_400_000).toISOString();
    expect(formatEchoPostedAt(t, NOW)).toBe('2d');
  });
  it('returns a w-suffixed string for sub-4-week deltas', () => {
    const t = new Date(NOW - 2 * 7 * 86_400_000).toISOString();
    expect(formatEchoPostedAt(t, NOW)).toBe('2w');
  });
  it('falls back to a locale date string when the delta reaches 4+ weeks', () => {
    const t = new Date(NOW - 5 * 7 * 86_400_000).toISOString();
    const out = formatEchoPostedAt(t, NOW);
    // contains digits and is NOT one of the shorthand buckets
    expect(out).toMatch(/[0-9]/);
    expect(out).not.toMatch(/just now|^[0-9]+(m|h|d|w)$/);
  });
});
