/**
 * AE267 — pure Unsplash photo URL builder.
 *
 * Today multiple surfaces concatenate the photo URL by hand:
 *   `https://images.unsplash.com/photo-${id}?auto=format&w=${w}`
 *
 * This helper canonicalises the params + the empty-id fallback so a
 * future provider swap (or a wider `auto=format,compress`) lands in
 * one place. Keeps the "/photo-" prefix optional — accepts either a
 * raw ID or a full photo path.
 */

export interface BuildPhotoUrlOptions {
  readonly width?: number;
  readonly height?: number;
  readonly quality?: number;
  readonly format?: 'auto' | 'jpg' | 'webp';
  readonly fit?: 'crop' | 'min' | 'max';
}

const HOST = 'https://images.unsplash.com';

export function buildPhotoUrl(id: string, opts: BuildPhotoUrlOptions = {}): string {
  const trimmed = id.trim();
  if (trimmed === '') return '';
  const path = trimmed.startsWith('photo-') ? trimmed : `photo-${trimmed}`;
  const params: string[] = [];
  // `auto` defaults to 'format' — Unsplash's recommended for editorial.
  params.push(`auto=${opts.format ?? 'format'}`);
  if (opts.width !== undefined) params.push(`w=${opts.width}`);
  if (opts.height !== undefined) params.push(`h=${opts.height}`);
  if (opts.quality !== undefined) params.push(`q=${opts.quality}`);
  if (opts.fit !== undefined) params.push(`fit=${opts.fit}`);
  return `${HOST}/${path}?${params.join('&')}`;
}
