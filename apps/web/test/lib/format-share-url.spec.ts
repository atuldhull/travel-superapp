/**
 * Vitest specs for AE218 buildShareUrl — the share-link URL helper.
 */
import { describe, expect, it } from 'vitest';
import { buildShareUrl } from '../../src/lib/format-share-url';

describe('buildShareUrl', () => {
  it('builds the legacy /shared path by default', () => {
    expect(buildShareUrl({ origin: 'https://app.example.com', code: 'abc123' })).toBe(
      'https://app.example.com/shared/abc123',
    );
  });

  it("'aether' surface uses /aether/shared", () => {
    expect(
      buildShareUrl({
        origin: 'https://app.example.com',
        code: 'abc123',
        surface: 'aether',
      }),
    ).toBe('https://app.example.com/aether/shared/abc123');
  });

  it('trims a trailing slash on origin', () => {
    expect(buildShareUrl({ origin: 'https://app.example.com/', code: 'x' })).toBe(
      'https://app.example.com/shared/x',
    );
  });

  it('empty origin still produces a valid root-relative path', () => {
    expect(buildShareUrl({ origin: '', code: 'x' })).toBe('/shared/x');
  });

  it('empty code returns empty string (caller decides what to render)', () => {
    expect(buildShareUrl({ origin: 'https://x.com', code: '' })).toBe('');
  });

  it('encodes path-unsafe chars in the code (defensive)', () => {
    expect(buildShareUrl({ origin: 'https://x.com', code: 'a b/c' })).toBe(
      'https://x.com/shared/a%20b%2Fc',
    );
  });

  it("explicit 'legacy' surface matches the default", () => {
    const a = buildShareUrl({ origin: 'https://x.com', code: 'k' });
    const b = buildShareUrl({ origin: 'https://x.com', code: 'k', surface: 'legacy' });
    expect(a).toBe(b);
  });

  it('preserves port numbers + http scheme', () => {
    expect(buildShareUrl({ origin: 'http://localhost:3001', code: 'lh' })).toBe(
      'http://localhost:3001/shared/lh',
    );
  });
});
