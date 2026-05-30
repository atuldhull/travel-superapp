/**
 * Vitest specs for the AE114 → AE149 deriveChecklistSlug helper.
 *
 * Confirms: substring match is case-insensitive, undefined/empty/
 * whitespace returns undefined, unknown destinations return undefined,
 * and the catalogue is the same 15 slugs the dashboard hands to
 * <TripChecklist/>'s starter pack picker.
 */
import { describe, expect, it } from 'vitest';
import {
  CHECKLIST_DEST_SLUGS,
  deriveChecklistSlug,
} from '../../src/components/aether/journey/derive-checklist-slug';

describe('deriveChecklistSlug', () => {
  it('returns undefined for null / undefined / empty / whitespace', () => {
    expect(deriveChecklistSlug(null)).toBeUndefined();
    expect(deriveChecklistSlug(undefined)).toBeUndefined();
    expect(deriveChecklistSlug('')).toBeUndefined();
    expect(deriveChecklistSlug('   ')).toBeUndefined();
  });

  it('returns undefined for titles with no curated destination', () => {
    expect(deriveChecklistSlug('Trip to Atlantis')).toBeUndefined();
    expect(deriveChecklistSlug('Family yatra')).toBeUndefined();
  });

  it('picks the destination from a natural-language title', () => {
    expect(deriveChecklistSlug('Five days in Leh, Ladakh')).toBe('leh');
    expect(deriveChecklistSlug('Quick weekend at Anjuna')).toBe('anjuna');
    expect(deriveChecklistSlug('The pink city — Jaipur reset')).toBe('jaipur');
  });

  it('is case-insensitive on the title', () => {
    expect(deriveChecklistSlug('JAIPUR autumn')).toBe('jaipur');
    expect(deriveChecklistSlug('VaRaNaSi at dawn')).toBe('varanasi');
  });

  it('returns the first slug hit when the title mentions more than one', () => {
    // Order in CHECKLIST_DEST_SLUGS is deterministic; Leh appears
    // before Jaipur in the array.
    expect(deriveChecklistSlug('A Leh + Jaipur loop')).toBe('leh');
  });

  it('exposes exactly 15 curated slugs (matches Atlas pin set)', () => {
    expect(CHECKLIST_DEST_SLUGS.length).toBe(15);
    // No duplicates
    expect(new Set<string>(CHECKLIST_DEST_SLUGS).size).toBe(15);
  });

  it('every slug self-matches', () => {
    for (const slug of CHECKLIST_DEST_SLUGS) {
      expect(deriveChecklistSlug(`Trip to ${slug}`)).toBe(slug);
    }
  });
});
