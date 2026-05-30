/**
 * Vitest specs for AE243 formatPlanText.
 */
import { describe, expect, it } from 'vitest';
import { formatPlanText } from '../../src/components/aether/pulse/format-plan-text';

describe('formatPlanText', () => {
  it('empty input → ""', () => {
    expect(formatPlanText('')).toBe('');
  });

  it('whitespace-only → ""', () => {
    expect(formatPlanText('   \n\t  ')).toBe('');
  });

  it('drops a "Plan:" header on its own first line', () => {
    expect(formatPlanText('Plan:\nDay 1: Arrive')).toBe('Day 1: Arrive');
  });

  it('drops a "Itinerary:" header (case-insensitive)', () => {
    expect(formatPlanText('itinerary:\nDay 1')).toBe('Day 1');
  });

  it('drops a "Trip:" header', () => {
    expect(formatPlanText('Trip:\nFirst line')).toBe('First line');
  });

  it('does NOT drop a non-header first line', () => {
    expect(formatPlanText('Day 1: Arrive\nDay 2')).toBe('Day 1: Arrive\nDay 2');
  });

  it('does NOT drop "Plan:" if it has trailing text on the same line', () => {
    // "Plan: Day 1" is the planner just using a colon, not a header.
    expect(formatPlanText('Plan: Day 1\nDay 2')).toBe('Plan: Day 1\nDay 2');
  });

  it('collapses 3+ blank lines to 2', () => {
    expect(formatPlanText('a\n\n\n\nb')).toBe('a\n\nb');
  });

  it('preserves a single blank line between paragraphs', () => {
    expect(formatPlanText('a\n\nb')).toBe('a\n\nb');
  });

  it('trims trailing whitespace', () => {
    expect(formatPlanText('hello\n\n\n')).toBe('hello');
  });

  it('preserves leading non-header indent (markdown list)', () => {
    expect(formatPlanText('- one\n- two')).toBe('- one\n- two');
  });

  it('combined: header + extra blanks + trailing ws', () => {
    expect(formatPlanText('Plan:\n\nDay 1\n\n\n\nDay 2\n\n  ')).toBe('Day 1\n\nDay 2');
  });
});
