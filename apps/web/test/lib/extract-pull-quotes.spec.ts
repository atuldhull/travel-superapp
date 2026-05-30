/**
 * Vitest specs for AE260 extractPullQuotes + strongestPullQuote.
 */
import { describe, expect, it } from 'vitest';
import {
  extractPullQuotes,
  strongestPullQuote,
} from '../../src/components/aether/journal/extract-pull-quotes';

const body = [
  { kind: 'p' as const, text: 'opener paragraph' },
  { kind: 'pull' as const, text: 'short pull' },
  { kind: 'h2' as const, text: 'A heading' },
  { kind: 'p' as const, text: 'middle paragraph' },
  { kind: 'pull' as const, text: 'a much longer second pull quote that should win' },
  { kind: 'p' as const, text: 'closer' },
];

describe('extractPullQuotes', () => {
  it('returns only pull blocks in order', () => {
    expect(extractPullQuotes(body)).toEqual([
      'short pull',
      'a much longer second pull quote that should win',
    ]);
  });
  it('empty body → []', () => {
    expect(extractPullQuotes([])).toEqual([]);
  });
  it('body without pull blocks → []', () => {
    expect(
      extractPullQuotes([
        { kind: 'p', text: 'a' },
        { kind: 'h2', text: 'b' },
      ]),
    ).toEqual([]);
  });
});

describe('strongestPullQuote', () => {
  it('returns the longest pull quote', () => {
    expect(strongestPullQuote(body)).toBe('a much longer second pull quote that should win');
  });
  it('single pull quote → that one', () => {
    expect(
      strongestPullQuote([
        { kind: 'p', text: 'a' },
        { kind: 'pull', text: 'only' },
      ]),
    ).toBe('only');
  });
  it('no pull quotes → null', () => {
    expect(strongestPullQuote([{ kind: 'p', text: 'a' }])).toBeNull();
  });
  it('ties resolve to the first encountered', () => {
    const got = strongestPullQuote([
      { kind: 'pull', text: 'same len' },
      { kind: 'pull', text: 'same len' },
    ]);
    expect(got).toBe('same len');
  });
});
