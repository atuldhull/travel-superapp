/**
 * Unit tests for `@app/clock` ([L4]).
 */
import { SYSTEM_CLOCK, SystemClock, makeFakeClock } from '../src';

describe('SystemClock', () => {
  it('now() returns a Date close to wall-clock', () => {
    const t = new SystemClock().now();
    expect(t).toBeInstanceOf(Date);
    expect(Math.abs(t.getTime() - Date.now())).toBeLessThan(200);
  });

  it('nowMs() returns a number close to Date.now()', () => {
    const ms = new SystemClock().nowMs();
    expect(typeof ms).toBe('number');
    expect(Math.abs(ms - Date.now())).toBeLessThan(200);
  });

  it('SYSTEM_CLOCK singleton works', () => {
    expect(SYSTEM_CLOCK.now()).toBeInstanceOf(Date);
  });
});

describe('makeFakeClock', () => {
  it('starts at the given moment (Date input)', () => {
    const c = makeFakeClock(new Date('2026-05-24T12:00:00Z'));
    expect(c.nowMs()).toBe(new Date('2026-05-24T12:00:00Z').getTime());
  });

  it('starts at the given moment (number input)', () => {
    const c = makeFakeClock(123_456);
    expect(c.nowMs()).toBe(123_456);
    expect(c.now()).toEqual(new Date(123_456));
  });

  it('advance(ms) rolls the clock forward', () => {
    const c = makeFakeClock(0);
    c.advance(1000);
    expect(c.nowMs()).toBe(1000);
    c.advance(500);
    expect(c.nowMs()).toBe(1500);
  });

  it('setNow() absolute jump', () => {
    const c = makeFakeClock(0);
    c.setNow(new Date('2030-01-01T00:00:00Z'));
    expect(c.nowMs()).toBe(new Date('2030-01-01').getTime());
    c.setNow(0);
    expect(c.nowMs()).toBe(0);
  });

  it('now() returns a FRESH Date each call (mutation safety)', () => {
    const c = makeFakeClock(1000);
    const a = c.now();
    const b = c.now();
    expect(a).not.toBe(b);
    expect(a.getTime()).toBe(b.getTime());
  });
});
