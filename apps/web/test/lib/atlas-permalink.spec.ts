/**
 * Vitest specs for AE358/AE359 Atlas permalink kit.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ATLAS_PARAMS,
  atlasParamsEqual,
  buildAtlasQuery,
  parseAtlasParams,
} from '../../src/components/aether/atlas/atlas-permalink';

describe('parseAtlasParams', () => {
  it('null / undefined input → defaults', () => {
    expect(parseAtlasParams(null)).toEqual(DEFAULT_ATLAS_PARAMS);
    expect(parseAtlasParams(undefined)).toEqual(DEFAULT_ATLAS_PARAMS);
  });

  it('accepts URLSearchParams instance', () => {
    const sp = new URLSearchParams('q=leh&season=1&focus=leh');
    expect(parseAtlasParams(sp)).toEqual({ q: 'leh', season: true, focus: 'leh' });
  });

  it('accepts plain object map (server-side context)', () => {
    expect(parseAtlasParams({ q: 'leh', season: '1', focus: 'leh' })).toEqual({
      q: 'leh',
      season: true,
      focus: 'leh',
    });
  });

  it('trims + collapses whitespace in q', () => {
    expect(parseAtlasParams({ q: '   leh    valley   ' }).q).toBe('leh valley');
  });

  it('caps q at 200 chars (defensive)', () => {
    const big = 'x'.repeat(500);
    expect(parseAtlasParams({ q: big }).q.length).toBe(200);
  });

  it('season is true only for canonical truthy strings', () => {
    for (const v of ['1', 'true', 'on']) {
      expect(parseAtlasParams({ season: v }).season).toBe(true);
    }
    for (const v of ['0', 'false', 'off', 'yes', '']) {
      expect(parseAtlasParams({ season: v }).season).toBe(false);
    }
  });

  it('focus slug shape gate: lowercase alphanum + dashes only', () => {
    expect(parseAtlasParams({ focus: 'leh' }).focus).toBe('leh');
    expect(parseAtlasParams({ focus: 'bhuj-rann' }).focus).toBe('bhuj-rann');
    expect(parseAtlasParams({ focus: 'LEH' }).focus).toBe('leh'); // toLowerCase before gate
    expect(parseAtlasParams({ focus: '../etc' }).focus).toBeNull();
    expect(parseAtlasParams({ focus: '-leading-dash' }).focus).toBeNull();
    expect(parseAtlasParams({ focus: '' }).focus).toBeNull();
  });

  it('partial fields fall back to per-field defaults', () => {
    expect(parseAtlasParams({ q: 'leh' })).toEqual({
      q: 'leh',
      season: false,
      focus: null,
    });
  });
});

describe('buildAtlasQuery', () => {
  it('all defaults → empty string', () => {
    expect(buildAtlasQuery(DEFAULT_ATLAS_PARAMS)).toBe('');
  });

  it('emits only the non-default fields', () => {
    expect(buildAtlasQuery({ q: 'leh', season: false, focus: null })).toBe('?q=leh');
    expect(buildAtlasQuery({ q: '', season: true, focus: null })).toBe('?season=1');
    expect(buildAtlasQuery({ q: '', season: false, focus: 'leh' })).toBe('?focus=leh');
  });

  it('emits combined fields in URLSearchParams order', () => {
    const out = buildAtlasQuery({ q: 'leh', season: true, focus: 'spiti' });
    expect(out).toMatch(/^\?/);
    expect(out).toContain('q=leh');
    expect(out).toContain('season=1');
    expect(out).toContain('focus=spiti');
  });

  it('URL-encodes oddball q values', () => {
    expect(buildAtlasQuery({ q: 'two words', season: false, focus: null })).toContain(
      'q=two+words',
    );
    expect(buildAtlasQuery({ q: 'a&b', season: false, focus: null })).toContain('q=a%26b');
  });

  it('round-trips: parse(build(p)) === p (when p is valid)', () => {
    for (const p of [
      { q: 'leh', season: false, focus: null },
      { q: 'leh', season: true, focus: 'leh' },
      { q: '', season: true, focus: 'spiti' },
      { q: 'two words', season: true, focus: 'bhuj' },
    ] as const) {
      const re = parseAtlasParams(new URLSearchParams(buildAtlasQuery(p).slice(1)));
      expect(re).toEqual(p);
    }
  });

  it('trims internal whitespace on the way out', () => {
    expect(buildAtlasQuery({ q: '  leh  ', season: false, focus: null })).toBe('?q=leh');
  });
});

describe('atlasParamsEqual', () => {
  it('identical objects → true', () => {
    const p = { q: 'leh', season: true, focus: 'leh' };
    expect(atlasParamsEqual(p, p)).toBe(true);
  });

  it('semantic equality (whitespace ignored on q)', () => {
    expect(
      atlasParamsEqual(
        { q: '  leh  ', season: false, focus: null },
        { q: 'leh', season: false, focus: null },
      ),
    ).toBe(true);
  });

  it('different season → false', () => {
    expect(
      atlasParamsEqual(
        { q: 'leh', season: true, focus: null },
        { q: 'leh', season: false, focus: null },
      ),
    ).toBe(false);
  });

  it('different focus → false', () => {
    expect(
      atlasParamsEqual(
        { q: 'leh', season: false, focus: 'leh' },
        { q: 'leh', season: false, focus: 'spiti' },
      ),
    ).toBe(false);
  });
});
