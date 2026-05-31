/**
 * Vitest specs for AE297 svgToDataUrl.
 */
import { describe, expect, it } from 'vitest';
import { svgToDataUrl } from '../../src/lib/svg-data-url';

const TINY = '<svg xmlns="http://www.w3.org/2000/svg"/>';

describe('svgToDataUrl', () => {
  it('default utf8 encoding', () => {
    const out = svgToDataUrl(TINY);
    expect(out.startsWith('data:image/svg+xml;utf8,')).toBe(true);
  });

  it('utf8 form URL-encodes < and > and "', () => {
    const out = svgToDataUrl(TINY);
    expect(out).toContain('%3Csvg');
    expect(out).toContain('%2F%3E');
  });

  it('base64 encoding switches the URI prefix', () => {
    const out = svgToDataUrl(TINY, { encoding: 'base64' });
    expect(out.startsWith('data:image/svg+xml;base64,')).toBe(true);
  });

  it('base64 round-trip recovers the SVG', () => {
    const out = svgToDataUrl(TINY, { encoding: 'base64' });
    const payload = out.slice('data:image/svg+xml;base64,'.length);
    const decoded = Buffer.from(payload, 'base64').toString('utf8');
    expect(decoded).toBe(TINY);
  });

  it('empty SVG → ""', () => {
    expect(svgToDataUrl('')).toBe('');
  });

  it('whitespace-only SVG → ""', () => {
    expect(svgToDataUrl('   \n\t  ')).toBe('');
  });

  it('preserves SVG content in utf8 mode via decodeURIComponent', () => {
    const url = svgToDataUrl(TINY);
    const payload = url.slice('data:image/svg+xml;utf8,'.length);
    expect(decodeURIComponent(payload)).toBe(TINY);
  });

  it('encodes ampersand entities', () => {
    const svg = '<svg><text>A &amp; B</text></svg>';
    const out = svgToDataUrl(svg);
    expect(out).toContain('%26amp');
  });
});
