/**
 * Vitest specs for AE279 buildShareMessage.
 */
import { describe, expect, it } from 'vitest';
import { SHARE_TAGLINE_MAX, buildShareMessage } from '../../src/lib/format-share-message';

describe('buildShareMessage', () => {
  it('full message: title + tagline + url', () => {
    expect(
      buildShareMessage({
        title: 'Leh winter trip',
        tagline: '5 days · ~50km radius',
        url: 'https://app.com/shared/abc',
      }),
    ).toBe('Leh winter trip\n5 days · ~50km radius\nhttps://app.com/shared/abc');
  });

  it('omits empty title', () => {
    expect(buildShareMessage({ title: '', tagline: 'taggy', url: 'https://x' })).toBe(
      'taggy\nhttps://x',
    );
  });

  it('omits empty tagline', () => {
    expect(buildShareMessage({ title: 't', url: 'https://x' })).toBe('t\nhttps://x');
  });

  it('omits empty url', () => {
    expect(buildShareMessage({ title: 't', tagline: 'taggy', url: '' })).toBe('t\ntaggy');
  });

  it('all empty → ""', () => {
    expect(buildShareMessage({ title: '', tagline: '', url: '' })).toBe('');
  });

  it('truncates tagline beyond SHARE_TAGLINE_MAX with ellipsis', () => {
    const long = 'x'.repeat(SHARE_TAGLINE_MAX + 50);
    const out = buildShareMessage({ title: 'T', tagline: long, url: 'https://x' });
    const taglineLine = out.split('\n')[1] ?? '';
    expect(taglineLine.length).toBeLessThanOrEqual(SHARE_TAGLINE_MAX);
    expect(taglineLine.endsWith('…')).toBe(true);
  });

  it('preserves a sub-cap tagline as-is (no ellipsis)', () => {
    const safe = 'x'.repeat(SHARE_TAGLINE_MAX);
    const out = buildShareMessage({ title: 'T', tagline: safe, url: 'u' });
    expect(out).toContain(safe);
    expect(out).not.toContain('…');
  });

  it('trims whitespace on every field', () => {
    expect(buildShareMessage({ title: '  t  ', tagline: '  taggy  ', url: '  https://x  ' })).toBe(
      't\ntaggy\nhttps://x',
    );
  });
});
