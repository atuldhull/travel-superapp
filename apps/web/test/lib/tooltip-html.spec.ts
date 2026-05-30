/**
 * Vitest specs for AE273 buildAtlasTooltipHtml.
 */
import { describe, expect, it } from 'vitest';
import { buildAtlasTooltipHtml } from '../../src/components/aether/atlas/tooltip-html';

describe('buildAtlasTooltipHtml', () => {
  it('includes name, state, tagline', () => {
    const out = buildAtlasTooltipHtml({
      name: 'Leh',
      state: 'Ladakh',
      tagline: 'Cold high desert',
      inSeason: false,
      accentBase: '#deadbe',
    });
    expect(out).toContain('Leh');
    expect(out).toContain('Ladakh');
    expect(out).toContain('Cold high desert');
  });

  it('renders in-season row only when true', () => {
    const off = buildAtlasTooltipHtml({
      name: 'a',
      state: 'b',
      tagline: 'c',
      inSeason: false,
      accentBase: '#000',
    });
    const on = buildAtlasTooltipHtml({
      name: 'a',
      state: 'b',
      tagline: 'c',
      inSeason: true,
      accentBase: '#000',
    });
    expect(off).not.toContain('in season now');
    expect(on).toContain('◐ in season now');
  });

  it('renders accentNote when provided', () => {
    const out = buildAtlasTooltipHtml({
      name: 'a',
      state: 'b',
      tagline: 'c',
      inSeason: false,
      accentBase: '#deadbe',
      accentNote: 'Mountain note',
    });
    expect(out).toContain('Mountain note');
    expect(out).toContain('#deadbe');
  });

  it('drops accentNote row when empty', () => {
    const out = buildAtlasTooltipHtml({
      name: 'a',
      state: 'b',
      tagline: 'c',
      inSeason: false,
      accentBase: '#000',
      accentNote: '',
    });
    expect(out).not.toContain('atlas-tt-note');
  });

  it('escapes <, >, &, ", \' in user-content fields', () => {
    const out = buildAtlasTooltipHtml({
      name: "O'Reilly & co",
      state: '<b>S</b>',
      tagline: 'A "great" trip',
      inSeason: false,
      accentBase: '#000',
    });
    expect(out).toContain('O&#39;Reilly &amp; co');
    expect(out).toContain('&lt;b&gt;S&lt;/b&gt;');
    expect(out).toContain('A &quot;great&quot; trip');
  });

  it('returned HTML wraps content in <div class="atlas-tt">', () => {
    const out = buildAtlasTooltipHtml({
      name: 'a',
      state: 'b',
      tagline: 'c',
      inSeason: false,
      accentBase: '#000',
    });
    expect(out.startsWith('<div class="atlas-tt">')).toBe(true);
    expect(out.endsWith('</div>')).toBe(true);
  });
});
