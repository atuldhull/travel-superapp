/**
 * AE593 — behavioural spec for `gesture-intent`.
 *
 * Pins the gesture→intent table + the confidence gate on `intentForEvent`.
 */
import { gestureIntent, intentForEvent, type Gesture, type GestureEvent } from '../src';

describe('AE593 — gestureIntent', () => {
  it('maps each gesture to its intent', () => {
    expect(gestureIntent('pinch')).toBe('select');
    expect(gestureIntent('open-palm')).toBe('dismiss');
    expect(gestureIntent('point')).toBe('focus');
    expect(gestureIntent('wave')).toBe('summon');
  });
  it('maps an unknown (widened-telemetry) gesture to none', () => {
    expect(gestureIntent('shrug' as Gesture)).toBe('none');
  });
});

describe('AE593 — intentForEvent', () => {
  const ev = (over: Partial<GestureEvent> = {}): GestureEvent => ({
    gesture: 'pinch',
    confidence: 0.9,
    capturedAt: 0,
    ...over,
  });
  it('returns the mapped intent for a confident event', () => {
    expect(intentForEvent(ev({ gesture: 'wave' }))).toBe('summon');
  });
  it('returns none for null or low-confidence events', () => {
    expect(intentForEvent(null)).toBe('none');
    expect(intentForEvent(ev({ confidence: 0.2 }))).toBe('none');
  });
  it('honours a custom confidence threshold', () => {
    expect(intentForEvent(ev({ confidence: 0.4 }), 0.3)).toBe('select');
  });
});
