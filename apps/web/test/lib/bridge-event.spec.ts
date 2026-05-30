/**
 * Vitest specs for the AE163 `aether-pulse-open` event decoder
 * (mirrors AE96 + AE146 runtime gates without mounting Pulse).
 */
import { describe, expect, it } from 'vitest';
import { decodePulseOpenEvent } from '../../src/components/aether/pulse/bridge-event';

describe('decodePulseOpenEvent', () => {
  it('returns empty + no-submit for null/undefined detail', () => {
    expect(decodePulseOpenEvent(null)).toEqual({ prefill: '', shouldSubmit: false });
    expect(decodePulseOpenEvent(undefined)).toEqual({ prefill: '', shouldSubmit: false });
  });

  it('returns empty + no-submit for non-object detail', () => {
    expect(decodePulseOpenEvent('hello')).toEqual({ prefill: '', shouldSubmit: false });
    expect(decodePulseOpenEvent(42)).toEqual({ prefill: '', shouldSubmit: false });
  });

  it('returns trimmed prefill', () => {
    expect(decodePulseOpenEvent({ prefill: '   leh trip   ' })).toEqual({
      prefill: 'leh trip',
      shouldSubmit: false,
    });
  });

  it('ignores prefill if it is not a string', () => {
    expect(decodePulseOpenEvent({ prefill: 123 })).toEqual({
      prefill: '',
      shouldSubmit: false,
    });
  });

  it('returns shouldSubmit=true when submit:true AND prefill non-empty', () => {
    expect(decodePulseOpenEvent({ prefill: 'plan jaipur', submit: true })).toEqual({
      prefill: 'plan jaipur',
      shouldSubmit: true,
    });
  });

  it('refuses to auto-submit on empty/whitespace prefill', () => {
    // Auto-submit on empty would open the drawer with nothing to ask.
    expect(decodePulseOpenEvent({ prefill: '   ', submit: true })).toEqual({
      prefill: '',
      shouldSubmit: false,
    });
    expect(decodePulseOpenEvent({ prefill: '', submit: true })).toEqual({
      prefill: '',
      shouldSubmit: false,
    });
    expect(decodePulseOpenEvent({ submit: true })).toEqual({
      prefill: '',
      shouldSubmit: false,
    });
  });

  it('treats submit=false / "true" string / missing as no auto-submit', () => {
    expect(decodePulseOpenEvent({ prefill: 'x', submit: false }).shouldSubmit).toBe(false);
    expect(decodePulseOpenEvent({ prefill: 'x', submit: 'true' }).shouldSubmit).toBe(false);
    expect(decodePulseOpenEvent({ prefill: 'x' }).shouldSubmit).toBe(false);
    expect(decodePulseOpenEvent({ prefill: 'x', submit: 1 }).shouldSubmit).toBe(false);
  });
});
