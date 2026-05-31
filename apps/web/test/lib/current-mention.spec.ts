/**
 * Vitest specs for AE363 currentMentionAtCursor + applyMentionCompletion.
 */
import { describe, expect, it } from 'vitest';
import {
  applyMentionCompletion,
  currentMentionAtCursor,
} from '../../src/components/aether/pulse/current-mention';

describe('currentMentionAtCursor', () => {
  it('empty text → null', () => {
    expect(currentMentionAtCursor('', 0)).toBeNull();
  });

  it("no '@' before cursor → null", () => {
    expect(currentMentionAtCursor('hello world', 5)).toBeNull();
  });

  it("'@' at cursor with empty query → returns the bare '@' mention", () => {
    const out = currentMentionAtCursor('Plan @', 6);
    expect(out).toEqual({ start: 5, end: 6, query: '' });
  });

  it("'@leh' with cursor at end → query 'leh'", () => {
    const out = currentMentionAtCursor('Plan @leh', 9);
    expect(out).toEqual({ start: 5, end: 9, query: 'leh' });
  });

  it('mid-token cursor narrows the query', () => {
    // 'Plan @leh' positions: P=0 l=1 a=2 n=3 ' '=4 @=5 l=6 e=7 h=8.
    // cursor=8 sits between 'e' and 'h' so query = 'le'.
    const out = currentMentionAtCursor('Plan @leh', 8);
    expect(out?.query).toBe('le');
    expect(out?.end).toBe(8);
  });

  it('lowercases the query', () => {
    expect(currentMentionAtCursor('Plan @LEH', 9)?.query).toBe('leh');
  });

  it("space after '@<query>' closes the mention", () => {
    expect(currentMentionAtCursor('Plan @leh and', 13)).toBeNull();
  });

  it('punctuation closes the mention', () => {
    expect(currentMentionAtCursor('Plan @leh,', 10)).toBeNull();
  });

  it('email-style "me@example" is NOT a mention', () => {
    expect(currentMentionAtCursor('me@example', 10)).toBeNull();
  });

  it("respects leading separator: '(@leh' is a mention", () => {
    expect(currentMentionAtCursor('(@leh', 5)?.query).toBe('leh');
  });

  it('multi-mention: cursor inside the second one returns the second', () => {
    expect(currentMentionAtCursor('@leh @alle', 10)).toEqual({
      start: 5,
      end: 10,
      query: 'alle',
    });
  });

  it('clamps out-of-range cursor', () => {
    expect(currentMentionAtCursor('@leh', 999)?.query).toBe('leh');
    expect(currentMentionAtCursor('@leh', -3)).toBeNull();
  });

  it('underscores + digits + dashes are mention chars', () => {
    expect(currentMentionAtCursor('@a1_b-2', 7)?.query).toBe('a1_b-2');
  });

  it('newline before @ counts as a separator', () => {
    expect(currentMentionAtCursor('hello\n@leh', 10)?.query).toBe('leh');
  });
});

describe('applyMentionCompletion', () => {
  it('inserts slug + advances cursor; preserves trailing text', () => {
    const out = applyMentionCompletion('Plan @le and stay', 8, 'leh');
    expect(out.text).toBe('Plan @leh and stay');
    expect(out.cursor).toBe(9); // after '@leh'
  });

  it('completes when cursor is right after the @', () => {
    const out = applyMentionCompletion('Plan @', 6, 'leh');
    expect(out.text).toBe('Plan @leh');
    expect(out.cursor).toBe(9);
  });

  it('no pending mention → returns input verbatim', () => {
    const out = applyMentionCompletion('Plan a trip', 6, 'leh');
    expect(out.text).toBe('Plan a trip');
    expect(out.cursor).toBe(6);
  });

  it("trailing punctuation/text doesn't get duplicated", () => {
    const out = applyMentionCompletion('Plan @le, more', 8, 'leh');
    expect(out.text).toBe('Plan @leh, more');
    expect(out.cursor).toBe(9);
  });

  it('replaces the partial query, not just appends', () => {
    const out = applyMentionCompletion('Plan @leh', 9, 'lehladakh');
    expect(out.text).toBe('Plan @lehladakh');
  });
});
