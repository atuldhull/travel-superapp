/** AE376 — destination-keys specs. */
import { italianKey } from '@app/aether-motion/audio';
import {
  DESTINATION_KEYS,
  curatedSlugs,
  hasCuratedKey,
  keySignatureFor,
} from '../src/destination-keys';

describe('DESTINATION_KEYS', () => {
  it('is non-empty and frozen', () => {
    expect(curatedSlugs().length).toBeGreaterThan(0);
    expect(Object.isFrozen(DESTINATION_KEYS)).toBe(true);
  });

  it('every entry has a non-empty scale + finite tempo', () => {
    for (const slug of curatedSlugs()) {
      const k = DESTINATION_KEYS[slug];
      expect(k).toBeDefined();
      expect(k!.scale.length).toBeGreaterThanOrEqual(5);
      expect(k!.tempo).toBeGreaterThanOrEqual(40);
      expect(k!.tempo).toBeLessThanOrEqual(140);
    }
  });

  it('every scale includes its own tonic (sane key)', () => {
    for (const slug of curatedSlugs()) {
      const k = DESTINATION_KEYS[slug]!;
      expect(k.scale).toContain(k.tonic);
    }
  });

  it('alias slugs map to the same key as their canonical', () => {
    expect(DESTINATION_KEYS['leh']).toBe(DESTINATION_KEYS['ladakh']);
    expect(DESTINATION_KEYS['anjuna']).toBe(DESTINATION_KEYS['goa']);
    expect(DESTINATION_KEYS['alleppey']).toBe(DESTINATION_KEYS['kerala']);
    expect(DESTINATION_KEYS['jaipur']).toBe(DESTINATION_KEYS['rajasthan']);
  });
});

describe('keySignatureFor', () => {
  it('returns the curated key for known slugs', () => {
    expect(keySignatureFor('leh')).toBe(DESTINATION_KEYS['leh']);
    expect(keySignatureFor('alleppey')).toBe(DESTINATION_KEYS['alleppey']);
    expect(keySignatureFor('varanasi')).toBe(DESTINATION_KEYS['varanasi']);
  });

  it('is case-insensitive', () => {
    expect(keySignatureFor('LEH')).toBe(DESTINATION_KEYS['leh']);
    expect(keySignatureFor('Alleppey')).toBe(DESTINATION_KEYS['alleppey']);
  });

  it('falls back to italianKey for unknown slugs', () => {
    expect(keySignatureFor('atlantis')).toBe(italianKey);
    expect(keySignatureFor('')).toBe(italianKey);
  });

  it('falls back to italianKey for nullish slugs', () => {
    expect(keySignatureFor(null)).toBe(italianKey);
    expect(keySignatureFor(undefined)).toBe(italianKey);
  });
});

describe('hasCuratedKey', () => {
  it('true for known slugs', () => {
    expect(hasCuratedKey('leh')).toBe(true);
    expect(hasCuratedKey('Leh')).toBe(true);
    expect(hasCuratedKey('alleppey')).toBe(true);
  });

  it('false for unknown / empty / nullish', () => {
    expect(hasCuratedKey('atlantis')).toBe(false);
    expect(hasCuratedKey('')).toBe(false);
    expect(hasCuratedKey(null)).toBe(false);
    expect(hasCuratedKey(undefined)).toBe(false);
  });
});

describe('curatedSlugs', () => {
  it('matches DESTINATION_KEYS keys', () => {
    expect(curatedSlugs()).toEqual(Object.keys(DESTINATION_KEYS));
  });

  it('contains the four canonical Indian region slugs', () => {
    const slugs = curatedSlugs();
    for (const expected of ['leh', 'alleppey', 'jaipur', 'varanasi']) {
      expect(slugs).toContain(expected);
    }
  });
});
