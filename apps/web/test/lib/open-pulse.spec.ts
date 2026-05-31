/**
 * Vitest specs for AE331 openPulse.
 *
 * Runs under jsdom — `window.dispatchEvent` is real, we attach a
 * listener to inspect the detail payload.
 */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openPulse } from '../../src/components/aether/pulse/open-pulse';

describe('openPulse', () => {
  let calls: Array<{ prefill: string; submit?: boolean }>;
  let handler: (e: Event) => void;

  beforeEach(() => {
    calls = [];
    handler = (e) => {
      const detail = (e as CustomEvent<{ prefill: string; submit?: boolean }>).detail;
      calls.push(detail);
    };
    window.addEventListener('aether-pulse-open', handler);
  });

  afterEach(() => {
    window.removeEventListener('aether-pulse-open', handler);
  });

  it('dispatches CustomEvent with the prefill (returns true)', () => {
    expect(openPulse('Take me to Leh')).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.prefill).toBe('Take me to Leh');
    // submit omitted when not explicitly true
    expect(calls[0]?.submit).toBeUndefined();
  });

  it('forwards submit=true when requested', () => {
    openPulse('Run this now', { submit: true });
    expect(calls[0]?.submit).toBe(true);
  });

  it('does NOT forward submit when explicitly false (kept absent)', () => {
    openPulse('No auto-send', { submit: false });
    expect(calls[0]?.submit).toBeUndefined();
  });

  it('allows empty / whitespace prefill (decoder is the gate)', () => {
    // openPulse is a fire-and-forget dispatcher; the AE163 decoder
    // trims + gates downstream. We just confirm dispatch still happens.
    expect(openPulse('')).toBe(true);
    expect(openPulse('   ')).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it('SSR (no window) → returns false, no throw', () => {
    const realWindow = globalThis.window;
    // @ts-expect-error simulate SSR
    delete globalThis.window;
    try {
      expect(openPulse('anything')).toBe(false);
    } finally {
      globalThis.window = realWindow;
    }
  });

  it('multiple dispatches in one tick all reach the listener', () => {
    openPulse('one');
    openPulse('two');
    openPulse('three', { submit: true });
    expect(calls.map((c) => c.prefill)).toEqual(['one', 'two', 'three']);
    expect(calls[2]?.submit).toBe(true);
  });

  it('event is dispatched on the real window object', () => {
    const spy = vi.spyOn(window, 'dispatchEvent');
    openPulse('spied');
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
