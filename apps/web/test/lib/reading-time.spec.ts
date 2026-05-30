/**
 * Vitest specs for AE209 estimateReadingMinutes — the WPM-based
 * reading-time estimator used by the journal + future Pulse/RSS
 * surfaces.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_READING_WPM,
  estimateReadingMinutes,
} from '../../src/components/aether/journal/reading-time';

const STR = (n: number): string => 'word '.repeat(n).trim();

describe('estimateReadingMinutes', () => {
  it('empty string → 0 (not 1)', () => {
    expect(estimateReadingMinutes('')).toBe(0);
  });

  it('whitespace-only → 0', () => {
    expect(estimateReadingMinutes('   \n\t  ')).toBe(0);
  });

  it('1 word → 1 min (round up + min-1 floor)', () => {
    expect(estimateReadingMinutes('hi')).toBe(1);
  });

  it('220 words (exactly 1 minute at default WPM) → 1', () => {
    expect(estimateReadingMinutes(STR(DEFAULT_READING_WPM))).toBe(1);
  });

  it('221 words rounds UP to 2', () => {
    expect(estimateReadingMinutes(STR(DEFAULT_READING_WPM + 1))).toBe(2);
  });

  it('440 words → 2 min', () => {
    expect(estimateReadingMinutes(STR(DEFAULT_READING_WPM * 2))).toBe(2);
  });

  it('sums words across the body-block array shape', () => {
    expect(
      estimateReadingMinutes([
        { text: STR(100) },
        { text: STR(120) },
        { text: STR(1) }, // 221 total → 2 min
      ]),
    ).toBe(2);
  });

  it('empty blocks contribute nothing', () => {
    expect(estimateReadingMinutes([{ text: '' }, { text: STR(5) }])).toBe(1);
  });

  it('honours a custom WPM', () => {
    // 100 words at 100 wpm = 1 minute.
    expect(estimateReadingMinutes(STR(100), 100)).toBe(1);
    // 101 words at 100 wpm = 2 minutes.
    expect(estimateReadingMinutes(STR(101), 100)).toBe(2);
  });

  it('non-positive WPM degenerates to 0 (defensive)', () => {
    expect(estimateReadingMinutes(STR(100), 0)).toBe(0);
    expect(estimateReadingMinutes(STR(100), -50)).toBe(0);
  });

  it('multi-whitespace collapses to a single word boundary', () => {
    expect(estimateReadingMinutes('one\n\ttwo   three')).toBe(1);
    // verify the count via 3-word equivalence
    expect(estimateReadingMinutes(STR(3))).toBe(1);
  });

  it('DEFAULT_READING_WPM is the canonical 220 (sanity gate)', () => {
    expect(DEFAULT_READING_WPM).toBe(220);
  });
});
