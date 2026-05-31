/** Vitest specs for AE391 Continuum landing parser + formatter. */
import { describe, expect, it } from 'vitest';
import {
  NO_CONTINUUM_LANDING,
  formatContinuumLandingMessage,
  readContinuumLanding,
} from '../../src/components/aether/phase1/continuum-landing';
import { CONTINUUM_QUERY_KEY } from '../../src/components/aether/phase1/continuum-state';

describe('readContinuumLanding (pure)', () => {
  it('returns NO_CONTINUUM_LANDING for null / undefined', () => {
    expect(readContinuumLanding(null)).toBe(NO_CONTINUUM_LANDING);
    expect(readContinuumLanding(undefined)).toBe(NO_CONTINUUM_LANDING);
  });

  it('returns NO_CONTINUUM_LANDING when marker absent', () => {
    const p = new URLSearchParams('focus=leh');
    const out = readContinuumLanding(p);
    expect(out.isHandoff).toBe(false);
  });

  it('detects marker via URLSearchParams', () => {
    const p = new URLSearchParams(`${CONTINUUM_QUERY_KEY}=1`);
    expect(readContinuumLanding(p).isHandoff).toBe(true);
  });

  it('returns extras WITHOUT the marker key', () => {
    const p = new URLSearchParams(`focus=leh&${CONTINUUM_QUERY_KEY}=1&trip=abc`);
    const out = readContinuumLanding(p);
    expect(out.isHandoff).toBe(true);
    expect(out.extras).toEqual({ focus: 'leh', trip: 'abc' });
    expect(out.extras[CONTINUUM_QUERY_KEY]).toBeUndefined();
  });

  it('rejects marker values other than 1', () => {
    expect(readContinuumLanding(new URLSearchParams(`${CONTINUUM_QUERY_KEY}=0`)).isHandoff).toBe(
      false,
    );
    expect(readContinuumLanding(new URLSearchParams(`${CONTINUUM_QUERY_KEY}=yes`)).isHandoff).toBe(
      false,
    );
    // '' present-but-empty also rejects.
    expect(readContinuumLanding(new URLSearchParams(`${CONTINUUM_QUERY_KEY}=`)).isHandoff).toBe(
      false,
    );
  });

  it('accepts a plain object payload', () => {
    const out = readContinuumLanding({ [CONTINUUM_QUERY_KEY]: '1', focus: 'leh' });
    expect(out.isHandoff).toBe(true);
    expect(out.extras).toEqual({ focus: 'leh' });
  });

  it('first-array-value wins for plain-object payloads', () => {
    const out = readContinuumLanding({
      [CONTINUUM_QUERY_KEY]: ['1', '0'],
      focus: ['leh', 'goa'],
    });
    expect(out.isHandoff).toBe(true);
    expect(out.extras.focus).toBe('leh');
  });

  it('plain-object: undefined values are dropped', () => {
    const out = readContinuumLanding({
      [CONTINUUM_QUERY_KEY]: '1',
      focus: 'leh',
      missing: undefined,
    });
    expect(out.extras.missing).toBeUndefined();
  });

  it('NO_CONTINUUM_LANDING is structurally empty', () => {
    expect(NO_CONTINUUM_LANDING.isHandoff).toBe(false);
    expect(Object.keys(NO_CONTINUUM_LANDING.extras).length).toBe(0);
  });
});

describe('formatContinuumLandingMessage (pure)', () => {
  it('bare message when no extras', () => {
    expect(formatContinuumLandingMessage({})).toBe('Continued from another device');
  });

  it('trip extras → "Trip restored"', () => {
    const m = formatContinuumLandingMessage({ trip: 'abc-123' });
    expect(m).toContain('trip restored');
    expect(m.startsWith('Continued from another device · ')).toBe(true);
  });

  it('focus extras → "focused on <slug>"', () => {
    const m = formatContinuumLandingMessage({ focus: 'leh' });
    expect(m).toContain('focused on leh');
  });

  it('bearing extras → "bearing <deg>°"', () => {
    const m = formatContinuumLandingMessage({ bearing: '157' });
    expect(m).toContain('bearing 157°');
  });

  it('multiple known extras stack', () => {
    const m = formatContinuumLandingMessage({ trip: 'abc', focus: 'leh' });
    expect(m).toContain('trip restored');
    expect(m).toContain('focused on leh');
  });

  it('unknown extras are summarised as N hint(s)', () => {
    const m1 = formatContinuumLandingMessage({ mystery: 'x' });
    expect(m1).toContain('with 1 hint');
    const m2 = formatContinuumLandingMessage({ mystery: 'x', other: 'y' });
    expect(m2).toContain('with 2 hints');
  });

  it('known + unknown extras compose', () => {
    const m = formatContinuumLandingMessage({ trip: 'abc', mystery: 'x' });
    expect(m).toContain('trip restored');
    expect(m).toContain('with 1 hint');
  });
});
