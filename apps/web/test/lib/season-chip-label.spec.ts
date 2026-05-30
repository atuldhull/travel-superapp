/**
 * Vitest specs for AE293 seasonChipLabel.
 */
import { describe, expect, it } from 'vitest';
import { seasonChipLabel } from '../../src/components/aether/destinations/season-chip-label';

describe('seasonChipLabel', () => {
  it('inSeason → default "◐ In season now"', () => {
    expect(seasonChipLabel({ inSeason: true })).toBe('◐ In season now');
  });

  it('inSeason + bestMonth → enriched label', () => {
    expect(seasonChipLabel({ inSeason: true, bestMonth: 'Oct' })).toBe('◐ In season · best Oct');
  });

  it('shoulder + !inSeason → "Edge of season"', () => {
    expect(seasonChipLabel({ inSeason: false, shoulder: true })).toBe('◐ Edge of season');
  });

  it('all off → "" (caller hides)', () => {
    expect(seasonChipLabel({ inSeason: false })).toBe('');
  });

  it('shoulder is ignored when already inSeason', () => {
    expect(seasonChipLabel({ inSeason: true, shoulder: true })).toBe('◐ In season now');
  });

  it('whitespace-only bestMonth treated as missing', () => {
    expect(seasonChipLabel({ inSeason: true, bestMonth: '   ' })).toBe('◐ In season now');
  });

  it('trims bestMonth', () => {
    expect(seasonChipLabel({ inSeason: true, bestMonth: '  Oct  ' })).toBe(
      '◐ In season · best Oct',
    );
  });
});
