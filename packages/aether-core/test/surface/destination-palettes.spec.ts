/** AE384 — destination-palette specs. */
import { DEFAULT_SURFACE_PALETTE } from '../../src/surface/palette';
import {
  DESTINATION_PALETTES,
  extractDestinationSlugFromTitle,
  hasCuratedPalette,
  paletteCuratedSlugs,
  paletteForDestination,
} from '../../src/surface/destination-palettes';

describe('DESTINATION_PALETTES', () => {
  it('is frozen + non-empty', () => {
    expect(Object.isFrozen(DESTINATION_PALETTES)).toBe(true);
    expect(paletteCuratedSlugs().length).toBeGreaterThan(0);
  });

  it('every entry is a 5-tuple of hex strings', () => {
    for (const slug of paletteCuratedSlugs()) {
      const p = DESTINATION_PALETTES[slug]!;
      expect(p.length).toBe(5);
      for (const c of p) {
        expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it('aliases share palette objects with their canonical', () => {
    expect(DESTINATION_PALETTES['leh']).toBe(DESTINATION_PALETTES['ladakh']);
    expect(DESTINATION_PALETTES['leh']).toBe(DESTINATION_PALETTES['spiti']);
    expect(DESTINATION_PALETTES['goa']).toBe(DESTINATION_PALETTES['anjuna']);
    expect(DESTINATION_PALETTES['goa']).toBe(DESTINATION_PALETTES['andaman']);
    expect(DESTINATION_PALETTES['kerala']).toBe(DESTINATION_PALETTES['alleppey']);
    expect(DESTINATION_PALETTES['rajasthan']).toBe(DESTINATION_PALETTES['jaipur']);
  });
});

describe('paletteForDestination', () => {
  it('returns the curated palette for known slugs', () => {
    expect(paletteForDestination('leh')).toBe(DESTINATION_PALETTES['leh']);
    expect(paletteForDestination('alleppey')).toBe(DESTINATION_PALETTES['alleppey']);
    expect(paletteForDestination('varanasi')).toBe(DESTINATION_PALETTES['varanasi']);
  });

  it('is case-insensitive', () => {
    expect(paletteForDestination('LEH')).toBe(DESTINATION_PALETTES['leh']);
    expect(paletteForDestination('Alleppey')).toBe(DESTINATION_PALETTES['alleppey']);
  });

  it('falls back to default for unknown slugs', () => {
    expect(paletteForDestination('atlantis')).toBe(DEFAULT_SURFACE_PALETTE);
  });

  it('falls back to default for nullish + empty', () => {
    expect(paletteForDestination(null)).toBe(DEFAULT_SURFACE_PALETTE);
    expect(paletteForDestination(undefined)).toBe(DEFAULT_SURFACE_PALETTE);
    expect(paletteForDestination('')).toBe(DEFAULT_SURFACE_PALETTE);
  });
});

describe('hasCuratedPalette', () => {
  it('true for known slugs (case-insensitive)', () => {
    expect(hasCuratedPalette('leh')).toBe(true);
    expect(hasCuratedPalette('Leh')).toBe(true);
    expect(hasCuratedPalette('jaipur')).toBe(true);
  });

  it('false for unknown/nullish/empty', () => {
    expect(hasCuratedPalette('atlantis')).toBe(false);
    expect(hasCuratedPalette('')).toBe(false);
    expect(hasCuratedPalette(null)).toBe(false);
    expect(hasCuratedPalette(undefined)).toBe(false);
  });
});

describe('extractDestinationSlugFromTitle', () => {
  it('null/empty → null', () => {
    expect(extractDestinationSlugFromTitle(null)).toBeNull();
    expect(extractDestinationSlugFromTitle(undefined)).toBeNull();
    expect(extractDestinationSlugFromTitle('')).toBeNull();
  });

  it('finds slug in a sentence', () => {
    expect(extractDestinationSlugFromTitle('Five days in Leh')).toBe('leh');
    expect(extractDestinationSlugFromTitle('Backwater trip in Alleppey')).toBe('alleppey');
    expect(extractDestinationSlugFromTitle('Quick Goa weekend')).toBe('goa');
  });

  it('is case-insensitive', () => {
    expect(extractDestinationSlugFromTitle('LEH expedition')).toBe('leh');
    expect(extractDestinationSlugFromTitle('VARANASI ghats')).toBe('varanasi');
  });

  it('returns null when no curated slug matches', () => {
    expect(extractDestinationSlugFromTitle('Trip to Atlantis')).toBeNull();
    expect(extractDestinationSlugFromTitle('Plan a journey')).toBeNull();
  });

  it('does NOT trip word-boundary false matches', () => {
    // "Goal" should not match 'goa' because of the \b regex.
    expect(extractDestinationSlugFromTitle('My yearly goal trip')).toBeNull();
    // "alleppey" inside another word would also not match (none of the
    // slugs share substrings with everyday words, but the boundary
    // check guards future additions).
    expect(extractDestinationSlugFromTitle('UNALLEPPEYABLE')).toBeNull();
  });

  it('first matching slug wins for multi-destination titles', () => {
    // Iteration order matches insertion in destination-palettes.ts.
    // 'leh' is registered before 'goa', so a title containing both
    // returns 'leh'.
    const result = extractDestinationSlugFromTitle('Combined Leh and Goa trip');
    expect(['leh', 'goa']).toContain(result);
    // Stronger assertion: insertion-order wins.
    expect(result).toBe('leh');
  });
});
