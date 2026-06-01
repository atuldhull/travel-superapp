/**
 * AE497 â€” canvas-shared own behavioural spec for `continuum-state`.
 *
 * The Continuum bar is the cross-device handoff surface (docs/aether/02-surfaces.md
 * section 10). This spec pins the deep-link fallback that Phase 1 ships: encode
 * a `ContinuumState` into a URL, parse such a URL back, detect the marker, and
 * derive a stable sigil seed. Everything here is pure â€” no `window`, no React.
 */
import {
  CONTINUUM_QUERY_KEY,
  buildContinuumUrl,
  continuumSigilSeed,
  isContinuumUrl,
  parseContinuumUrl,
  type ContinuumState,
} from '../src';

describe('AE497 â€” CONTINUUM_QUERY_KEY constant', () => {
  it('is the exact aether-continuum string the docs prescribe', () => {
    expect(CONTINUUM_QUERY_KEY).toBe('aether-continuum');
  });
});

describe('AE497 â€” buildContinuumUrl pathname normalisation', () => {
  it('injects a leading slash when the caller forgets one', () => {
    const out = buildContinuumUrl({ pathname: 'aether/atlas' });
    expect(out.startsWith('/aether/atlas')).toBe(true);
  });
  it('preserves an already-leading slash', () => {
    const out = buildContinuumUrl({ pathname: '/aether/drift' });
    expect(out.startsWith('/aether/drift')).toBe(true);
  });
  it('trims a trailing slash from non-root paths', () => {
    const out = buildContinuumUrl({ pathname: '/aether/atlas/' });
    expect(out.startsWith('/aether/atlas?')).toBe(true);
  });
  it('preserves the root slash exactly', () => {
    const out = buildContinuumUrl({ pathname: '/' });
    expect(out.startsWith('/?')).toBe(true);
  });
  it('collapses an empty pathname to the root', () => {
    const out = buildContinuumUrl({ pathname: '' });
    expect(out.startsWith('/?')).toBe(true);
  });
});

describe('AE497 â€” buildContinuumUrl origin handling', () => {
  it('returns a relative URL when origin is the empty string', () => {
    const out = buildContinuumUrl({ pathname: '/aether/atlas' }, '');
    expect(out.startsWith('/')).toBe(true);
    expect(out).not.toMatch(/^https?:/);
  });
  it('prepends a real origin verbatim when provided', () => {
    const out = buildContinuumUrl({ pathname: '/aether/atlas' }, 'https://aether.app');
    expect(out.startsWith('https://aether.app/aether/atlas')).toBe(true);
  });
  it('trims a trailing slash on the supplied origin', () => {
    const out = buildContinuumUrl({ pathname: '/aether/atlas' }, 'https://aether.app/');
    expect(out.startsWith('https://aether.app/aether/atlas')).toBe(true);
    expect(out.startsWith('https://aether.app//')).toBe(false);
  });
});

describe('AE497 â€” buildContinuumUrl marker + extras encoding', () => {
  it('always appends the aether-continuum=1 marker', () => {
    const out = buildContinuumUrl({ pathname: '/aether/atlas' });
    expect(out).toMatch(/[?&]aether-continuum=1\b/);
  });
  it('appends extras as URI-encoded search params', () => {
    const out = buildContinuumUrl({
      pathname: '/aether/atlas',
      extras: { focus: 'jaipur city palace' },
    });
    expect(out).toMatch(/focus=jaipur(\+|%20)city(\+|%20)palace/);
  });
  it('refuses to let an extras key shadow the marker', () => {
    const out = buildContinuumUrl({
      pathname: '/aether/atlas',
      extras: { [CONTINUUM_QUERY_KEY]: 'hijacked' },
    });
    expect(out).toMatch(/aether-continuum=1\b/);
    expect(out).not.toMatch(/hijacked/);
  });
  it('emits no extra params when extras is absent', () => {
    const out = buildContinuumUrl({ pathname: '/aether/drift' });
    // Only the marker is in the query string.
    expect(out).toBe('/aether/drift?aether-continuum=1');
  });
  it('emits no extra params when extras is an empty object', () => {
    const out = buildContinuumUrl({ pathname: '/aether/drift', extras: {} });
    expect(out).toBe('/aether/drift?aether-continuum=1');
  });
  it('serialises multi-key extras in insertion order ahead of the marker', () => {
    const out = buildContinuumUrl({
      pathname: '/aether/compass',
      extras: { bearing: '92', focus: 'leh' },
    });
    const search = out.split('?')[1] ?? '';
    const parts = search.split('&');
    expect(parts[0]).toBe('bearing=92');
    expect(parts[1]).toBe('focus=leh');
    expect(parts[parts.length - 1]).toBe('aether-continuum=1');
  });
});

describe('AE497 â€” parseContinuumUrl', () => {
  it('returns null for the empty string', () => {
    expect(parseContinuumUrl('')).toBe(null);
  });
  it('returns null for non-string input', () => {
    expect(parseContinuumUrl(null as unknown as string)).toBe(null);
    expect(parseContinuumUrl(undefined as unknown as string)).toBe(null);
    expect(parseContinuumUrl(42 as unknown as string)).toBe(null);
  });
  it('parses a relative URL into the normalised state', () => {
    const parsed = parseContinuumUrl('/aether/atlas?focus=leh&aether-continuum=1');
    expect(parsed).toEqual({ pathname: '/aether/atlas', extras: { focus: 'leh' } });
  });
  it('omits the extras key when the URL carries only the marker', () => {
    const parsed = parseContinuumUrl('/aether/drift?aether-continuum=1');
    expect(parsed).toEqual({ pathname: '/aether/drift' });
    expect(Object.prototype.hasOwnProperty.call(parsed, 'extras')).toBe(false);
  });
  it('tolerates URLs without the marker (helpers reusable for plain URLs)', () => {
    const parsed = parseContinuumUrl('/aether/atlas?focus=jaipur');
    expect(parsed).toEqual({ pathname: '/aether/atlas', extras: { focus: 'jaipur' } });
  });
  it('drops the marker key from the parsed extras', () => {
    const parsed = parseContinuumUrl('/x?a=1&aether-continuum=1');
    expect(parsed?.extras).toEqual({ a: '1' });
  });
  it('parses absolute URLs by extracting the pathname only', () => {
    const parsed = parseContinuumUrl('https://aether.app/aether/atlas?focus=leh');
    expect(parsed?.pathname).toBe('/aether/atlas');
    expect(parsed?.extras).toEqual({ focus: 'leh' });
  });
  it('round-trips an encoded build through the parser', () => {
    const state: ContinuumState = {
      pathname: '/aether/atlas',
      extras: { focus: 'jaipur', bearing: '92' },
    };
    const url = buildContinuumUrl(state, '');
    const parsed = parseContinuumUrl(url);
    expect(parsed).toEqual(state);
  });
});

describe('AE497 â€” isContinuumUrl marker probe', () => {
  it('is true for a URL carrying the marker set to 1', () => {
    expect(isContinuumUrl('/aether/atlas?aether-continuum=1')).toBe(true);
  });
  it('is false when the marker is missing', () => {
    expect(isContinuumUrl('/aether/atlas?focus=leh')).toBe(false);
  });
  it('is false when the marker value is not 1', () => {
    expect(isContinuumUrl('/aether/atlas?aether-continuum=0')).toBe(false);
    expect(isContinuumUrl('/aether/atlas?aether-continuum=true')).toBe(false);
  });
  it('is false for the empty string', () => {
    expect(isContinuumUrl('')).toBe(false);
  });
  it('is false for non-string input', () => {
    expect(isContinuumUrl(null as unknown as string)).toBe(false);
    expect(isContinuumUrl(undefined as unknown as string)).toBe(false);
  });
  it('agrees with buildContinuumUrl on its own output', () => {
    const url = buildContinuumUrl({ pathname: '/aether/atlas' });
    expect(isContinuumUrl(url)).toBe(true);
  });
});

describe('AE497 â€” continuumSigilSeed', () => {
  it('returns the canonical sans-origin URL string', () => {
    const seed = continuumSigilSeed({ pathname: '/aether/atlas', extras: { focus: 'leh' } });
    expect(seed).toBe('/aether/atlas?focus=leh&aether-continuum=1');
  });
  it('is identity-shared across devices that resolve the same handoff', () => {
    const a = continuumSigilSeed({ pathname: '/aether/atlas', extras: { focus: 'leh' } });
    const b = continuumSigilSeed({ pathname: '/aether/atlas', extras: { focus: 'leh' } });
    expect(a).toBe(b);
  });
  it('differs when extras differ', () => {
    const a = continuumSigilSeed({ pathname: '/aether/atlas', extras: { focus: 'leh' } });
    const b = continuumSigilSeed({ pathname: '/aether/atlas', extras: { focus: 'jaipur' } });
    expect(a).not.toBe(b);
  });
});
