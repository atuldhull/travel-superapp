/**
 * Vitest specs for AE206 timelineDotColor — the colour-routing helper
 * for the journey activity timeline dots.
 */
import { describe, expect, it } from 'vitest';
import {
  timelineDotColor,
  type TimelineDotPalette,
} from '../../src/components/aether/journey/timeline-dot-color';

const P: TimelineDotPalette = {
  ochre: { deep: '#OCHRE_DEEP', glow: '#OCHRE_GLOW' },
  olive: { deep: '#OLIVE_DEEP' },
  accent: { deep: '#ACCENT_DEEP' },
};

describe('timelineDotColor', () => {
  it('archive → ochre.deep', () => {
    expect(timelineDotColor('archive', P)).toBe('#OCHRE_DEEP');
  });
  it('edit → olive.deep', () => {
    expect(timelineDotColor('edit', P)).toBe('#OLIVE_DEEP');
  });
  it('share → ochre.glow', () => {
    expect(timelineDotColor('share', P)).toBe('#OCHRE_GLOW');
  });
  it('create → accent.deep (the fallback)', () => {
    expect(timelineDotColor('create', P)).toBe('#ACCENT_DEEP');
  });
  it('all four kinds yield distinct colours', () => {
    const got = new Set<string>(
      (['archive', 'edit', 'share', 'create'] as const).map((k) => timelineDotColor(k, P)),
    );
    expect(got.size).toBe(4);
  });
  it('archive and edit never collide (different visual rails)', () => {
    expect(timelineDotColor('archive', P)).not.toBe(timelineDotColor('edit', P));
  });
});
