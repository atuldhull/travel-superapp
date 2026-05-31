/**
 * AE297 — pure SVG-string → data URL helper.
 *
 * The AE79 trip-share-card download flow inlines this conversion:
 *   `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
 *
 * Lifted so:
 *   - the encoding chain is testable in isolation
 *   - a future swap to base64 (e.g. for clipboard image paste) lands
 *     in one place
 *   - empty / whitespace-only SVG returns '' so the caller renders
 *     a fallback instead of a broken anchor
 */

export type SvgDataUrlEncoding = 'utf8' | 'base64';

export interface SvgDataUrlOptions {
  readonly encoding?: SvgDataUrlEncoding;
}

function toBase64(s: string): string {
  if (typeof btoa === 'function') {
    // btoa needs Latin-1; for non-ASCII inputs we'd need encodeURIComponent
    // first. Our SVGs are ASCII-clean (no unicode in shareSvg output), so
    // direct btoa is fine.
    return btoa(s);
  }
  // Node fallback for SSR contexts.
  return Buffer.from(s, 'utf8').toString('base64');
}

export function svgToDataUrl(svg: string, opts: SvgDataUrlOptions = {}): string {
  if (svg.trim() === '') return '';
  const encoding = opts.encoding ?? 'utf8';
  if (encoding === 'base64') {
    return `data:image/svg+xml;base64,${toBase64(svg)}`;
  }
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
