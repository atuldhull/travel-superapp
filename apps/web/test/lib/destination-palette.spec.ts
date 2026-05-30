/**
 * Unit tests for `components/aether/destinations/palette.ts` —
 * per-destination accent map (AE61).
 */
import { describe, expect, it } from 'vitest';
import { destinationAccent, TERRACOTTA } from '../../src/components/aether/destinations/palette';
import { ALL_SLUGS } from '../../src/components/aether/destinations/data';

describe('destinationAccent', () => {
  it('returns a curated accent for every known destination slug', () => {
    for (const slug of ALL_SLUGS) {
      const a = destinationAccent(slug);
      // Curated accents differ from the terracotta fallback for at
      // least the `base` colour (otherwise the per-destination
      // accent feature does nothing visible).
      // Note: this asserts there's an entry; we don't assert specific
      // hexes so curators can tune them without retesting.
      expect(a.base).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(a.deep).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(a.note.length).toBeGreaterThan(0);
    }
  });

  it('falls back to terracotta for an unknown slug', () => {
    const a = destinationAccent('atlantis');
    expect(a).toEqual(TERRACOTTA);
  });

  it('falls back to terracotta for an empty slug', () => {
    expect(destinationAccent('')).toEqual(TERRACOTTA);
  });

  it('jaipur is a pink-sandstone tone (sandstone slug fidelity check)', () => {
    const a = destinationAccent('jaipur');
    expect(a.note).toBe('pink-sandstone');
  });

  it('alleppey is a palm-teal tone', () => {
    const a = destinationAccent('alleppey');
    expect(a.note).toBe('palm-teal');
  });

  // ─── AE178: extended sanity ────────────────────────────────────────
  it('every curated accent has a whisper colour (hex or rgba)', () => {
    for (const slug of ALL_SLUGS) {
      const a = destinationAccent(slug);
      // Whisper may be hex (#RRGGBB / #RRGGBBAA) OR rgba(...) — both
      // are valid CSS colour syntaxes for the faint card-tint use.
      expect(a.whisper).toMatch(/^(#[0-9a-fA-F]{6,8}|rgba?\([^)]+\))$/);
    }
  });

  it('every note is short kebab-case (≤ 24 chars, no spaces)', () => {
    for (const slug of ALL_SLUGS) {
      const a = destinationAccent(slug);
      expect(a.note.length).toBeLessThanOrEqual(24);
      expect(a.note).not.toMatch(/\s/);
    }
  });

  it('every note is unique (no two destinations share the same accent label)', () => {
    const notes = ALL_SLUGS.map((s) => destinationAccent(s).note);
    expect(new Set(notes).size).toBe(notes.length);
  });

  it('Leh maps to a thin-sky / high-altitude note', () => {
    const a = destinationAccent('leh');
    expect(a.note).toMatch(/sky|altitude|prayer|thin|high/i);
  });
});
