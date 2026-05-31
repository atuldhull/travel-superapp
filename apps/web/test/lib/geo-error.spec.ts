/**
 * Vitest specs for AE329 interpretGeolocationError.
 */
import { describe, expect, it } from 'vitest';
import { interpretGeolocationError } from '../../src/components/aether/atlas/geo-error';

describe('interpretGeolocationError', () => {
  it('code 1 → denied (canonical permission-denied message)', () => {
    const out = interpretGeolocationError({ code: 1, message: 'whatever' });
    expect(out.status).toBe('denied');
    expect(out.message).toMatch(/permission denied/i);
  });

  it('code 2 (POSITION_UNAVAILABLE) → unavailable + uses Error.message when present', () => {
    const err = Object.assign(new Error('GPS off'), { code: 2 });
    const out = interpretGeolocationError(err);
    expect(out.status).toBe('unavailable');
    expect(out.message).toBe('GPS off');
  });

  it('code 3 (TIMEOUT) → unavailable + uses default when not Error', () => {
    const out = interpretGeolocationError({ code: 3 });
    expect(out.status).toBe('unavailable');
    expect(out.message).toMatch(/could not read/i);
  });

  it('plain Error (no code) → unavailable, surfaces Error.message', () => {
    const out = interpretGeolocationError(new Error('boom'));
    expect(out.status).toBe('unavailable');
    expect(out.message).toBe('boom');
  });

  it('non-Error non-coded (string / null / undefined) → unavailable + default message', () => {
    expect(interpretGeolocationError('huh').status).toBe('unavailable');
    expect(interpretGeolocationError('huh').message).toMatch(/could not read/i);
    expect(interpretGeolocationError(null).status).toBe('unavailable');
    expect(interpretGeolocationError(undefined).status).toBe('unavailable');
  });

  it('code 1 wins even when Error.message is set', () => {
    const out = interpretGeolocationError(Object.assign(new Error('ignored'), { code: 1 }));
    expect(out.status).toBe('denied');
    expect(out.message).toMatch(/permission denied/i);
  });
});
