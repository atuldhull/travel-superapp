/** Vitest specs for AE401 media download URL extractors. */
import { describe, expect, it } from 'vitest';
import {
  extractDownloadExpiresAt,
  extractDownloadUrl,
} from '../../src/components/aether/phase2/media-download-url';

describe('extractDownloadUrl (pure)', () => {
  it('returns the url when present', () => {
    expect(
      extractDownloadUrl({
        url: 'https://cdn.example.com/x.jpg',
        expiresAt: '2026-06-15T11:00:00Z',
      }),
    ).toBe('https://cdn.example.com/x.jpg');
  });

  it('null / undefined input → null', () => {
    expect(extractDownloadUrl(null)).toBeNull();
    expect(extractDownloadUrl(undefined)).toBeNull();
  });

  it('missing url field → null', () => {
    // @ts-expect-error simulating a partial / malformed response
    expect(extractDownloadUrl({ expiresAt: '2026-06-15T11:00:00Z' })).toBeNull();
  });

  it('non-string url → null', () => {
    // @ts-expect-error simulating a partial / malformed response
    expect(extractDownloadUrl({ url: 123, expiresAt: 'x' })).toBeNull();
    // @ts-expect-error
    expect(extractDownloadUrl({ url: null, expiresAt: 'x' })).toBeNull();
  });

  it('empty string url → null', () => {
    expect(extractDownloadUrl({ url: '', expiresAt: '2026-06-15T11:00:00Z' })).toBeNull();
  });
});

describe('extractDownloadExpiresAt (pure)', () => {
  it('returns the expiresAt when present', () => {
    expect(extractDownloadExpiresAt({ url: 'https://x', expiresAt: '2026-06-15T11:00:00Z' })).toBe(
      '2026-06-15T11:00:00Z',
    );
  });

  it('null / undefined → null', () => {
    expect(extractDownloadExpiresAt(null)).toBeNull();
    expect(extractDownloadExpiresAt(undefined)).toBeNull();
  });

  it('missing / non-string / empty → null', () => {
    // @ts-expect-error
    expect(extractDownloadExpiresAt({ url: 'x' })).toBeNull();
    // @ts-expect-error
    expect(extractDownloadExpiresAt({ url: 'x', expiresAt: 42 })).toBeNull();
    expect(extractDownloadExpiresAt({ url: 'x', expiresAt: '' })).toBeNull();
  });
});
