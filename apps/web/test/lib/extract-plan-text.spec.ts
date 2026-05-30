/**
 * Vitest specs for AE213 extractPlanText — defensive payload
 * unwrap for the Pulse sample-plan response.
 */
import { describe, expect, it } from 'vitest';
import { extractPlanText } from '../../src/components/aether/pulse/extract-plan-text';

describe('extractPlanText', () => {
  it('happy path: { data: { plan: "..." } } → plan string', () => {
    expect(extractPlanText({ data: { plan: 'Day 1: arrive' } })).toBe('Day 1: arrive');
  });

  it('null response → ""', () => {
    expect(extractPlanText(null)).toBe('');
  });

  it('undefined response → ""', () => {
    expect(extractPlanText(undefined)).toBe('');
  });

  it('non-object response → ""', () => {
    expect(extractPlanText('plain string')).toBe('');
    expect(extractPlanText(42)).toBe('');
    expect(extractPlanText(true)).toBe('');
  });

  it('missing data → ""', () => {
    expect(extractPlanText({})).toBe('');
  });

  it('null data → ""', () => {
    expect(extractPlanText({ data: null })).toBe('');
  });

  it('non-object data → ""', () => {
    expect(extractPlanText({ data: 'lol' })).toBe('');
  });

  it('missing plan field → ""', () => {
    expect(extractPlanText({ data: {} })).toBe('');
  });

  it('non-string plan → ""', () => {
    expect(extractPlanText({ data: { plan: 42 } })).toBe('');
    expect(extractPlanText({ data: { plan: null } })).toBe('');
    expect(extractPlanText({ data: { plan: { nested: true } } })).toBe('');
  });

  it('empty string plan is preserved as ""', () => {
    expect(extractPlanText({ data: { plan: '' } })).toBe('');
  });

  it('preserves leading whitespace (planner emits meaningful indent)', () => {
    expect(extractPlanText({ data: { plan: '   leading' } })).toBe('   leading');
  });
});
