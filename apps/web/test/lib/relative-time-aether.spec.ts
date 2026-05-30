/**
 * Vitest specs for AE253 formatRelativeAether.
 */
import { describe, expect, it } from 'vitest';
import { formatRelativeAether } from '../../src/lib/relative-time-aether';

const NOW = new Date('2026-06-15T12:00:00Z');
const T = (offsetMs: number): Date => new Date(NOW.getTime() - offsetMs);

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('formatRelativeAether', () => {
  it('null → ""', () => {
    expect(formatRelativeAether(null, NOW)).toBe('');
  });

  it('undefined → ""', () => {
    expect(formatRelativeAether(undefined, NOW)).toBe('');
  });

  it('garbage → ""', () => {
    expect(formatRelativeAether('not-a-date', NOW)).toBe('');
  });

  it('< 60s → "just now"', () => {
    expect(formatRelativeAether(T(30 * SEC), NOW)).toBe('just now');
  });

  it('5m ago', () => {
    expect(formatRelativeAether(T(5 * MIN), NOW)).toBe('5m ago');
  });

  it('59m ago (boundary)', () => {
    expect(formatRelativeAether(T(59 * MIN), NOW)).toBe('59m ago');
  });

  it('1h ago', () => {
    expect(formatRelativeAether(T(1 * HOUR), NOW)).toBe('1h ago');
  });

  it('3d ago', () => {
    expect(formatRelativeAether(T(3 * DAY), NOW)).toBe('3d ago');
  });

  it('2w ago (14 days)', () => {
    expect(formatRelativeAether(T(14 * DAY), NOW)).toBe('2w ago');
  });

  it('3mo ago (~90 days)', () => {
    expect(formatRelativeAether(T(90 * DAY), NOW)).toBe('3mo ago');
  });

  it('1y ago (~365 days)', () => {
    expect(formatRelativeAether(T(366 * DAY), NOW)).toBe('1y ago');
  });

  it('future timestamps render as "in <n><unit>"', () => {
    const future = new Date(NOW.getTime() + 5 * MIN);
    expect(formatRelativeAether(future, NOW)).toBe('in 5m');
  });

  it('future < 60s → "in a moment"', () => {
    const future = new Date(NOW.getTime() + 30 * SEC);
    expect(formatRelativeAether(future, NOW)).toBe('in a moment');
  });

  it('accepts ISO string input', () => {
    const past = new Date(NOW.getTime() - 5 * MIN).toISOString();
    expect(formatRelativeAether(past, NOW)).toBe('5m ago');
  });
});
