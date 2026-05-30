/**
 * Vitest specs for AE294 shortTripTitle.
 */
import { describe, expect, it } from 'vitest';
import {
  SHORT_TITLE_DEFAULT,
  shortTripTitle,
} from '../../src/components/aether/journey/short-trip-title';

describe('shortTripTitle', () => {
  it('empty → ""', () => {
    expect(shortTripTitle('')).toBe('');
  });

  it('whitespace-only → ""', () => {
    expect(shortTripTitle('   ')).toBe('');
  });

  it('short title under max → unchanged', () => {
    expect(shortTripTitle('Leh')).toBe('Leh');
  });

  it('exactly at default max → unchanged', () => {
    const title = 'x'.repeat(SHORT_TITLE_DEFAULT);
    expect(shortTripTitle(title)).toBe(title);
  });

  it('past max → cut at last space + ellipsis', () => {
    const title = 'A long winter journey through the valleys of Spiti';
    const got = shortTripTitle(title, { max: 20 });
    expect(got.endsWith('…')).toBe(true);
    expect(got.length).toBeLessThanOrEqual(20 + 1);
    // No mid-word truncation: the title-cut shouldn't split 'journey'
    // mid-word (which would yield 'A long winter journe…').
    expect(got).not.toContain('journe…');
  });

  it('honours custom max', () => {
    const title = 'one two three four five six';
    const got = shortTripTitle(title, { max: 12 });
    expect(got.length).toBeLessThanOrEqual(13);
    expect(got.endsWith('…')).toBe(true);
  });

  it('falls back to hard cut when no space within max', () => {
    const title = 'supercalifragilisticexpialidocious';
    const got = shortTripTitle(title, { max: 10 });
    expect(got.endsWith('…')).toBe(true);
    expect(got.length).toBeLessThanOrEqual(10);
  });

  it('trims input', () => {
    expect(shortTripTitle('  Leh  ')).toBe('Leh');
  });

  it('SHORT_TITLE_DEFAULT is the canonical 28', () => {
    expect(SHORT_TITLE_DEFAULT).toBe(28);
  });
});
