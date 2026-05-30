/**
 * Vitest specs for AE288 stripMarkdown.
 */
import { describe, expect, it } from 'vitest';
import { stripMarkdown } from '../../src/lib/markdown-strip';

describe('stripMarkdown', () => {
  it('plain text → unchanged', () => {
    expect(stripMarkdown('hello world')).toBe('hello world');
  });
  it('empty → ""', () => {
    expect(stripMarkdown('')).toBe('');
  });
  it('strips **bold**', () => {
    expect(stripMarkdown('a **bold** word')).toBe('a bold word');
  });
  it('strips __bold__', () => {
    expect(stripMarkdown('an __also bold__ word')).toBe('an also bold word');
  });
  it('strips *italic*', () => {
    expect(stripMarkdown('a *little* italic')).toBe('a little italic');
  });
  it('strips _italic_', () => {
    expect(stripMarkdown('a _quiet_ word')).toBe('a quiet word');
  });
  it('strips `code` spans', () => {
    expect(stripMarkdown('use `npm test` to run')).toBe('use npm test to run');
  });
  it('reduces [text](url) to text', () => {
    expect(stripMarkdown('see [docs](https://example.com)')).toBe('see docs');
  });
  it('strips heading marks', () => {
    expect(stripMarkdown('# H1\n## H2\ntext')).toBe('H1\nH2\ntext');
  });
  it('strips bullet markers', () => {
    expect(stripMarkdown('- one\n- two\n* three\n+ four')).toBe('one\ntwo\nthree\nfour');
  });
  it('combined: bold + link + code', () => {
    expect(stripMarkdown('**Click** [here](https://x) and run `cmd`')).toBe(
      'Click here and run cmd',
    );
  });
  it('does NOT strip standalone asterisks (no pair)', () => {
    expect(stripMarkdown('1 * 2 = 2')).toBe('1 * 2 = 2');
  });
});
