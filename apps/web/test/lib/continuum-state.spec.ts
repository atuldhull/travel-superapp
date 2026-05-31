/** Vitest specs for AE390 Continuum state encode/decode. */
import { describe, expect, it } from 'vitest';
import {
  CONTINUUM_QUERY_KEY,
  buildContinuumUrl,
  continuumSigilSeed,
  isContinuumUrl,
  parseContinuumUrl,
} from '../../src/components/aether/phase1/continuum-state';

describe('buildContinuumUrl (pure)', () => {
  it('writes the marker query param', () => {
    const url = buildContinuumUrl({ pathname: '/aether/drift' });
    expect(url).toBe(`/aether/drift?${CONTINUUM_QUERY_KEY}=1`);
  });

  it('preserves extras in insertion order', () => {
    const url = buildContinuumUrl({
      pathname: '/aether/journey/abc',
      extras: { trip: 'abc', focus: 'leh' },
    });
    expect(url).toBe(`/aether/journey/abc?trip=abc&focus=leh&${CONTINUUM_QUERY_KEY}=1`);
  });

  it('prepends an explicit origin', () => {
    const url = buildContinuumUrl({ pathname: '/aether/atlas' }, 'https://app.example.com');
    expect(url).toBe(`https://app.example.com/aether/atlas?${CONTINUUM_QUERY_KEY}=1`);
  });

  it('strips a trailing slash on origin', () => {
    const url = buildContinuumUrl({ pathname: '/x' }, 'https://app.example.com/');
    expect(url).toBe(`https://app.example.com/x?${CONTINUUM_QUERY_KEY}=1`);
  });

  it('URI-encodes extras values', () => {
    const url = buildContinuumUrl({
      pathname: '/aether/drift',
      extras: { tag: 'Slow + Mindful' },
    });
    // URLSearchParams encodes space as + and + as %2B.
    expect(url).toContain('tag=Slow+%2B+Mindful');
    expect(url).toContain(`${CONTINUUM_QUERY_KEY}=1`);
  });

  it('refuses to let extras override the marker key', () => {
    const url = buildContinuumUrl({
      pathname: '/aether/drift',
      // Adversarial caller tries to pre-set the marker to 0.
      extras: { [CONTINUUM_QUERY_KEY]: '0' },
    });
    expect(url.endsWith(`?${CONTINUUM_QUERY_KEY}=1`)).toBe(true);
  });

  it('normalises missing leading slash + strips trailing', () => {
    const url = buildContinuumUrl({ pathname: 'aether/drift/' });
    expect(url.startsWith('/aether/drift?')).toBe(true);
  });

  it("'' pathname collapses to '/'", () => {
    const url = buildContinuumUrl({ pathname: '' });
    expect(url.startsWith('/?')).toBe(true);
  });
});

describe('parseContinuumUrl (pure)', () => {
  it('round-trips a no-extras state', () => {
    const built = buildContinuumUrl({ pathname: '/aether/drift' });
    const parsed = parseContinuumUrl(built);
    expect(parsed).toEqual({ pathname: '/aether/drift' });
  });

  it('round-trips a with-extras state', () => {
    const orig = { pathname: '/aether/journey/abc', extras: { trip: 'abc', focus: 'leh' } };
    const built = buildContinuumUrl(orig);
    const parsed = parseContinuumUrl(built);
    expect(parsed?.pathname).toBe('/aether/journey/abc');
    expect(parsed?.extras).toEqual({ trip: 'abc', focus: 'leh' });
  });

  it('omits the marker key from extras', () => {
    const url = `/x?focus=leh&${CONTINUUM_QUERY_KEY}=1`;
    const parsed = parseContinuumUrl(url);
    expect(parsed?.extras).toEqual({ focus: 'leh' });
    expect(parsed?.extras?.[CONTINUUM_QUERY_KEY]).toBeUndefined();
  });

  it('parses an absolute-origin URL', () => {
    const built = buildContinuumUrl({ pathname: '/aether/atlas' }, 'https://app.example.com');
    const parsed = parseContinuumUrl(built);
    expect(parsed?.pathname).toBe('/aether/atlas');
  });

  it('returns null on non-string / empty', () => {
    expect(parseContinuumUrl('')).toBeNull();
    expect(parseContinuumUrl(undefined as unknown as string)).toBeNull();
  });

  it('returns null on un-parseable junk', () => {
    expect(parseContinuumUrl('http://[invalid')).toBeNull();
  });

  it('decodes URI-encoded extras values', () => {
    const url = `/aether/drift?tag=Slow+%2B+Mindful&${CONTINUUM_QUERY_KEY}=1`;
    const parsed = parseContinuumUrl(url);
    expect(parsed?.extras?.['tag']).toBe('Slow + Mindful');
  });

  it('strips the path trailing slash on parse', () => {
    const parsed = parseContinuumUrl('/aether/drift/?x=1');
    expect(parsed?.pathname).toBe('/aether/drift');
  });
});

describe('isContinuumUrl (pure)', () => {
  it('true when marker is present', () => {
    expect(isContinuumUrl(`/x?${CONTINUUM_QUERY_KEY}=1`)).toBe(true);
  });
  it('false when marker is absent', () => {
    expect(isContinuumUrl('/x')).toBe(false);
    expect(isContinuumUrl('/x?other=1')).toBe(false);
  });
  it('false on non-string / empty / invalid', () => {
    expect(isContinuumUrl('')).toBe(false);
    expect(isContinuumUrl(undefined as unknown as string)).toBe(false);
    expect(isContinuumUrl('http://[invalid')).toBe(false);
  });
  it('false when marker value is not 1', () => {
    expect(isContinuumUrl(`/x?${CONTINUUM_QUERY_KEY}=0`)).toBe(false);
    expect(isContinuumUrl(`/x?${CONTINUUM_QUERY_KEY}=yes`)).toBe(false);
  });
});

describe('continuumSigilSeed (pure)', () => {
  it('is identity-stable for identical states', () => {
    const a = continuumSigilSeed({ pathname: '/aether/drift' });
    const b = continuumSigilSeed({ pathname: '/aether/drift' });
    expect(a).toBe(b);
  });
  it('differs for different pathnames', () => {
    const a = continuumSigilSeed({ pathname: '/aether/drift' });
    const b = continuumSigilSeed({ pathname: '/aether/atlas' });
    expect(a).not.toBe(b);
  });
  it('differs when extras differ', () => {
    const a = continuumSigilSeed({ pathname: '/x', extras: { focus: 'leh' } });
    const b = continuumSigilSeed({ pathname: '/x', extras: { focus: 'goa' } });
    expect(a).not.toBe(b);
  });
  it('does NOT include origin (so receiver matches sender)', () => {
    // The seed is the canonical pathname+extras-relative URL — no
    // origin variation means a sender on https://prod and a receiver
    // on the SAME host still share an identity seed.
    const seed = continuumSigilSeed({ pathname: '/aether/drift' });
    expect(seed.startsWith('/')).toBe(true);
    expect(seed).not.toContain('http');
  });
});
