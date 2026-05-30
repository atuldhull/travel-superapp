/**
 * Vitest specs for AE283 shareCardTitleSize.
 */
import { describe, expect, it } from 'vitest';
import {
  MID_TITLE_THRESHOLD,
  SIZE_LARGE,
  SIZE_MID,
  SIZE_SMALL,
  TIGHT_TITLE_THRESHOLD,
  shareCardTitleSize,
} from '../../src/components/aether/journey/share-card-title-tier';

describe('shareCardTitleSize', () => {
  it('short title → SIZE_LARGE', () => {
    expect(shareCardTitleSize('Leh')).toBe(SIZE_LARGE);
  });

  it('exactly TIGHT_TITLE_THRESHOLD chars → SIZE_LARGE (closed)', () => {
    expect(shareCardTitleSize('x'.repeat(TIGHT_TITLE_THRESHOLD))).toBe(SIZE_LARGE);
  });

  it('one past TIGHT → SIZE_MID', () => {
    expect(shareCardTitleSize('x'.repeat(TIGHT_TITLE_THRESHOLD + 1))).toBe(SIZE_MID);
  });

  it('exactly MID_TITLE_THRESHOLD → SIZE_MID (closed)', () => {
    expect(shareCardTitleSize('x'.repeat(MID_TITLE_THRESHOLD))).toBe(SIZE_MID);
  });

  it('one past MID → SIZE_SMALL', () => {
    expect(shareCardTitleSize('x'.repeat(MID_TITLE_THRESHOLD + 1))).toBe(SIZE_SMALL);
  });

  it('very long → SIZE_SMALL', () => {
    expect(shareCardTitleSize('x'.repeat(200))).toBe(SIZE_SMALL);
  });

  it('trims surrounding whitespace before counting', () => {
    expect(shareCardTitleSize(`  ${'x'.repeat(TIGHT_TITLE_THRESHOLD)}  `)).toBe(SIZE_LARGE);
  });

  it('empty → SIZE_LARGE (no overflow risk)', () => {
    expect(shareCardTitleSize('')).toBe(SIZE_LARGE);
  });

  it('AE193 fixtures: 21-char tier-2 boundary', () => {
    expect(shareCardTitleSize('x'.repeat(21))).toBe(SIZE_MID);
  });

  it('AE193 fixtures: 29-char tier-3 boundary', () => {
    expect(shareCardTitleSize('x'.repeat(29))).toBe(SIZE_SMALL);
  });

  it('size constants are descending', () => {
    expect(SIZE_LARGE).toBeGreaterThan(SIZE_MID);
    expect(SIZE_MID).toBeGreaterThan(SIZE_SMALL);
  });
});
