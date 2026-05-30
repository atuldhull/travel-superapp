/**
 * Vitest specs for AE258 sentenceCase.
 */
import { describe, expect, it } from 'vitest';
import { sentenceCase } from '../../src/lib/sentence-case';

describe('sentenceCase', () => {
  it('ALL CAPS → Sentence', () => {
    expect(sentenceCase('PLAN A TRIP TO LEH')).toBe('Plan a trip to leh');
  });
  it('Title Case → Sentence', () => {
    expect(sentenceCase('Plan A Trip To Leh')).toBe('Plan a trip to leh');
  });
  it('already sentence case → unchanged', () => {
    expect(sentenceCase('Plan a trip to leh')).toBe('Plan a trip to leh');
  });
  it('keepAsIs restores proper noun (case-insensitive match)', () => {
    expect(sentenceCase('plan a trip to leh', ['Leh'])).toBe('Plan a trip to Leh');
  });
  it('keepAsIs match preserves the keep-as-is exact casing', () => {
    expect(sentenceCase('go to ALLEPPEY now', ['Alleppey'])).toBe('Go to Alleppey now');
  });
  it('multiple keep-as-is words', () => {
    expect(sentenceCase('book a ride from leh to jaipur', ['Leh', 'Jaipur'])).toBe(
      'Book a ride from Leh to Jaipur',
    );
  });
  it('empty input → ""', () => {
    expect(sentenceCase('')).toBe('');
  });
  it('whitespace-only → ""', () => {
    expect(sentenceCase('   \n\t  ')).toBe('');
  });
  it('trims input before processing', () => {
    expect(sentenceCase('  HELLO  ')).toBe('Hello');
  });
  it('empty keep-as-is entry is skipped', () => {
    expect(sentenceCase('hello world', [''])).toBe('Hello world');
  });
  it('keep-as-is matches only on word boundaries', () => {
    // "leh" inside "lehenga" should NOT be preserved as "Leh".
    expect(sentenceCase('a lehenga from delhi', ['Leh'])).toBe('A lehenga from delhi');
  });
  it('acronym preservation via keepAsIs', () => {
    expect(sentenceCase('please RSVP today', ['RSVP'])).toBe('Please RSVP today');
  });
});
