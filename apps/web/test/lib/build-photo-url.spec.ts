/**
 * Vitest specs for AE267 buildPhotoUrl.
 */
import { describe, expect, it } from 'vitest';
import { buildPhotoUrl } from '../../src/lib/build-photo-url';

describe('buildPhotoUrl', () => {
  it('minimum URL with raw id', () => {
    expect(buildPhotoUrl('abc123')).toBe('https://images.unsplash.com/photo-abc123?auto=format');
  });

  it('accepts a full path with photo- prefix', () => {
    expect(buildPhotoUrl('photo-abc123')).toBe(
      'https://images.unsplash.com/photo-abc123?auto=format',
    );
  });

  it('honours width', () => {
    expect(buildPhotoUrl('abc', { width: 800 })).toBe(
      'https://images.unsplash.com/photo-abc?auto=format&w=800',
    );
  });

  it('honours all params together', () => {
    expect(buildPhotoUrl('abc', { width: 800, height: 600, quality: 75, fit: 'crop' })).toBe(
      'https://images.unsplash.com/photo-abc?auto=format&w=800&h=600&q=75&fit=crop',
    );
  });

  it('honours custom format', () => {
    expect(buildPhotoUrl('abc', { format: 'webp' })).toBe(
      'https://images.unsplash.com/photo-abc?auto=webp',
    );
  });

  it('empty id → "" (caller decides what to render)', () => {
    expect(buildPhotoUrl('')).toBe('');
  });

  it('whitespace-only id → ""', () => {
    expect(buildPhotoUrl('   ')).toBe('');
  });

  it('trims the id', () => {
    expect(buildPhotoUrl('  abc  ')).toBe('https://images.unsplash.com/photo-abc?auto=format');
  });

  it('always uses https + images.unsplash.com host', () => {
    expect(buildPhotoUrl('abc')).toMatch(/^https:\/\/images\.unsplash\.com\//);
  });
});
