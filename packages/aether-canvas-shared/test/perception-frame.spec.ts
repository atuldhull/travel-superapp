/**
 * AE591 — behavioural spec for `perception-frame`.
 *
 * Pins the confidence + staleness guards (incl. null / out-of-bounds /
 * non-finite inputs) + the frozen gesture list + idle frame that the
 * gaze-zone, gesture-intent, recognizer, and mock all build on.
 */
import {
  IDLE_PERCEPTION_STATE,
  PERCEPTION_GESTURES,
  isConfidentGaze,
  isConfidentGesture,
  isGazeStale,
  type GazePoint,
  type GestureEvent,
} from '../src';

const gaze = (over: Partial<GazePoint> = {}): GazePoint => ({
  x: 0.5,
  y: 0.5,
  confidence: 0.9,
  capturedAt: 1000,
  ...over,
});

describe('AE591 — isConfidentGaze', () => {
  it('accepts an in-bounds, confident gaze', () => {
    expect(isConfidentGaze(gaze())).toBe(true);
  });
  it('rejects null', () => {
    expect(isConfidentGaze(null)).toBe(false);
  });
  it('rejects sub-threshold confidence', () => {
    expect(isConfidentGaze(gaze({ confidence: 0.3 }))).toBe(false);
  });
  it('rejects out-of-[0,1] or non-finite coordinates', () => {
    expect(isConfidentGaze(gaze({ x: 1.5 }))).toBe(false);
    expect(isConfidentGaze(gaze({ y: -0.1 }))).toBe(false);
    expect(isConfidentGaze(gaze({ x: Number.NaN }))).toBe(false);
  });
  it('honours a custom threshold', () => {
    expect(isConfidentGaze(gaze({ confidence: 0.4 }), 0.3)).toBe(true);
  });
  it('accepts confidence exactly at the floor but rejects super-unit garbage', () => {
    expect(isConfidentGaze(gaze({ confidence: 0.5 }))).toBe(true); // == default floor (>=)
    expect(isConfidentGaze(gaze({ confidence: 5 }))).toBe(false); // out of [0,1]
  });
});

describe('AE591 — isGazeStale', () => {
  it('treats null / non-finite timestamps as stale', () => {
    expect(isGazeStale(null, 1000)).toBe(true);
    expect(isGazeStale(gaze({ capturedAt: Number.NaN }), 1000)).toBe(true);
    expect(isGazeStale(gaze(), Number.NaN)).toBe(true);
  });
  it('is fresh within the TTL and stale beyond it', () => {
    expect(isGazeStale(gaze({ capturedAt: 1000 }), 1200, 400)).toBe(false); // 200ms old
    expect(isGazeStale(gaze({ capturedAt: 1000 }), 1500, 400)).toBe(true); // 500ms old
  });
  it('treats a delta exactly equal to the TTL as fresh (strict >)', () => {
    expect(isGazeStale(gaze({ capturedAt: 1000 }), 1400, 400)).toBe(false); // delta == ttl
  });
});

describe('AE591 — isConfidentGesture', () => {
  const ev = (over: Partial<GestureEvent> = {}): GestureEvent => ({
    gesture: 'pinch',
    confidence: 0.8,
    capturedAt: 0,
    ...over,
  });
  it('accepts a confident gesture, rejects null + low confidence', () => {
    expect(isConfidentGesture(ev())).toBe(true);
    expect(isConfidentGesture(null)).toBe(false);
    expect(isConfidentGesture(ev({ confidence: 0.2 }))).toBe(false);
  });
  it('accepts confidence exactly at the floor, rejects super-unit garbage', () => {
    expect(isConfidentGesture(ev({ confidence: 0.6 }))).toBe(true); // == default floor
    expect(isConfidentGesture(ev({ confidence: 5 }))).toBe(false); // out of [0,1]
  });
});

describe('AE591 — constants', () => {
  it('PERCEPTION_GESTURES is the frozen list of all four gestures', () => {
    expect(PERCEPTION_GESTURES).toHaveLength(4);
    expect([...PERCEPTION_GESTURES].sort()).toEqual(['open-palm', 'pinch', 'point', 'wave']);
    expect(Object.isFrozen(PERCEPTION_GESTURES)).toBe(true);
  });
  it('IDLE_PERCEPTION_STATE is the frozen nothing-perceived frame', () => {
    expect(IDLE_PERCEPTION_STATE).toEqual({ gaze: null, gesture: null, active: false });
    expect(Object.isFrozen(IDLE_PERCEPTION_STATE)).toBe(true);
  });
});
