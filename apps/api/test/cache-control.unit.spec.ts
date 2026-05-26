/**
 * Cache-Control helpers — unit tests ([Q6]).
 */
import { setCacheNoStore, setCachePublic } from '../src/common/cache-control/cache-control';

function makeRes(): { header: jest.Mock; headers: Map<string, string> } {
  const headers = new Map<string, string>();
  return {
    headers,
    header: jest.fn((name: string, value: string) => {
      headers.set(name, value);
    }),
  };
}

describe('setCacheNoStore', () => {
  it('emits Cache-Control: no-store + Pragma: no-cache', () => {
    const res = makeRes();
    setCacheNoStore(res as never);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Pragma')).toBe('no-cache');
  });
});

describe('setCachePublic', () => {
  it('emits all three core directives plus stale-while-revalidate by default', () => {
    const res = makeRes();
    setCachePublic(res as never, { edgeTtl: 60, browserTtl: 0 });
    expect(res.headers.get('Cache-Control')).toBe(
      'public, max-age=0, s-maxage=60, stale-while-revalidate=60',
    );
    expect(res.headers.get('Vary')).toBe('Accept-Encoding, Accept-Language');
  });

  it('uses the explicit staleWhileRevalidate when provided', () => {
    const res = makeRes();
    setCachePublic(res as never, { edgeTtl: 30, browserTtl: 10, staleWhileRevalidate: 120 });
    expect(res.headers.get('Cache-Control')).toBe(
      'public, max-age=10, s-maxage=30, stale-while-revalidate=120',
    );
  });

  it('omits stale-while-revalidate when set to 0', () => {
    const res = makeRes();
    setCachePublic(res as never, { edgeTtl: 60, browserTtl: 0, staleWhileRevalidate: 0 });
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=0, s-maxage=60');
  });

  it('handles long edge TTLs (immutable-ish content)', () => {
    const res = makeRes();
    setCachePublic(res as never, { edgeTtl: 86400, browserTtl: 3600 });
    expect(res.headers.get('Cache-Control')).toBe(
      'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
    );
  });
});
