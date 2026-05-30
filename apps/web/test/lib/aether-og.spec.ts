/**
 * Unit tests for `lib/aether-og.ts` — the shared OG + Twitter Card
 * metadata builder used by every Aether route's `page.tsx`.
 */
import { describe, expect, it } from 'vitest';
import { aetherOg } from '../../src/lib/aether-og';

describe('aetherOg', () => {
  it('returns openGraph + twitter blocks with the canonical shape', () => {
    const out = aetherOg('Aether · Test', 'A test description.');
    expect(out.openGraph).toBeDefined();
    expect(out.twitter).toBeDefined();
    // The OG / Twitter Next types are heavily discriminated; cast via
    // unknown to make assertions plainly.
    const og = out.openGraph as unknown as Record<string, unknown>;
    expect(og['title']).toBe('Aether · Test');
    expect(og['description']).toBe('A test description.');
    expect(og['siteName']).toBe('TravelSuperApp · Aether');
    expect(og['type']).toBe('website');
  });

  it('defaults the OG image to the Taj Mahal hero id when no photoId given', () => {
    const out = aetherOg('T', 'D');
    const images = (out.openGraph?.images ?? []) as Array<{ url: string; alt: string }>;
    expect(images.length).toBe(1);
    expect(images[0]?.url).toContain('1564507592333-c60657eea523');
    expect(images[0]?.alt).toBe('T');
  });

  it('uses the supplied photoId when provided', () => {
    const out = aetherOg('T', 'D', { photoId: 'abc-123' });
    const images = (out.openGraph?.images ?? []) as Array<{ url: string }>;
    expect(images[0]?.url).toContain('abc-123');
  });

  it('builds a summary_large_image Twitter card sharing the same image', () => {
    const out = aetherOg('T', 'D', { photoId: 'xyz-789' });
    const tw = out.twitter as unknown as Record<string, unknown>;
    expect(tw['card']).toBe('summary_large_image');
    const twImages = (tw['images'] ?? []) as readonly string[];
    expect(twImages).toHaveLength(1);
    expect(String(twImages[0])).toContain('xyz-789');
  });

  it('sets the OG image dimensions to the 1200x630 OG canonical', () => {
    const out = aetherOg('T', 'D');
    const images = (out.openGraph?.images ?? []) as Array<{ width: number; height: number }>;
    expect(images[0]?.width).toBe(1200);
    expect(images[0]?.height).toBe(630);
  });

  // ─── AE179: extended ────────────────────────────────────────────────
  it('returns a fresh object on each call (no shared mutation)', () => {
    const a = aetherOg('T', 'D');
    const b = aetherOg('T', 'D');
    expect(a).not.toBe(b);
    expect(a.openGraph).not.toBe(b.openGraph);
  });

  it('handles empty title / description without throwing', () => {
    const out = aetherOg('', '');
    expect(out.openGraph).toBeDefined();
    expect(out.twitter).toBeDefined();
  });

  it('alt text uses the title verbatim (not the dek)', () => {
    const out = aetherOg('The pink city', 'Editorial dek');
    const images = (out.openGraph?.images ?? []) as Array<{ alt: string }>;
    expect(images[0]?.alt).toBe('The pink city');
  });

  it('reuses the same image URL across openGraph + twitter blocks', () => {
    const out = aetherOg('T', 'D', { photoId: 'shared-1' });
    const ogUrl = String(((out.openGraph?.images ?? []) as Array<{ url: string }>)[0]?.url);
    const twImages = (out.twitter as unknown as { images?: readonly string[] }).images ?? [];
    expect(String(twImages[0])).toBe(ogUrl);
  });
});
