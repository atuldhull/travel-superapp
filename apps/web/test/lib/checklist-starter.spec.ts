/**
 * Vitest specs for the AE114 checklist starter helper.
 *
 * Confirms:
 *   • Unknown slug → falls back to the generic STARTER (5 items).
 *   • Known slugs (leh / anjuna / jaipur / alleppey) → return their
 *     curated packs, NOT the generic STARTER.
 *   • Slug is case-insensitive ("LEH" === "leh").
 *   • Each call returns a fresh array (mutating one shouldn't leak).
 *
 * The helper is exported from `trip-checklist.tsx` because the
 * destination-aware starter logic lives next to the component that
 * consumes it; the pure function shape makes it cheap to test.
 */
import { describe, expect, it } from 'vitest';
import { starterForSlug } from '../../src/components/aether/journey/trip-checklist';

describe('starterForSlug', () => {
  it('returns the generic 5-item STARTER when slug is undefined', () => {
    const got = starterForSlug(undefined);
    expect(got.length).toBe(5);
    expect(got[0]?.text).toBe('Photo ID + photocopy');
  });

  it('returns the generic STARTER when slug is unknown', () => {
    const got = starterForSlug('atlantis');
    expect(got.length).toBe(5);
    expect(got[0]?.text).toBe('Photo ID + photocopy');
  });

  it('returns a Leh-specific pack', () => {
    const got = starterForSlug('leh');
    expect(got.length).toBeGreaterThanOrEqual(5);
    const blob = got.map((it) => it.text.toLowerCase()).join('|');
    // Leh-specific cues
    expect(blob).toMatch(/down jacket/);
    expect(blob).toMatch(/altitude|diamox/);
    // Should NOT be the generic starter
    expect(got[0]?.text).not.toBe('Photo ID + photocopy');
  });

  it('returns an Anjuna-specific pack', () => {
    const got = starterForSlug('anjuna');
    const blob = got.map((it) => it.text.toLowerCase()).join('|');
    expect(blob).toMatch(/swim|spf|scooter/);
  });

  it('is case-insensitive on the slug', () => {
    const lower = starterForSlug('jaipur');
    const upper = starterForSlug('JAIPUR');
    expect(upper.map((it) => it.text)).toEqual(lower.map((it) => it.text));
  });

  it('returns a fresh array each call (no shared mutation)', () => {
    const a = starterForSlug('alleppey');
    const b = starterForSlug('alleppey');
    a.length = 0; // mutate one
    expect(b.length).toBeGreaterThan(0); // other untouched
  });

  it('marks every item as not done by default', () => {
    for (const slug of ['leh', 'jaipur', 'anjuna', 'varanasi', 'alleppey']) {
      const items = starterForSlug(slug);
      expect(items.every((it) => it.done === false)).toBe(true);
    }
  });
});
