/**
 * AE595 — behavioural spec for `mock-perception`.
 *
 * Pins the deterministic source: stable for a given t, gaze in bounds, the
 * gesture schedule + cycle, non-finite-t safety, and the always-active
 * full frame.
 */
import {
  MOCK_GESTURE_ACTIVE_MS,
  MOCK_GESTURE_WINDOW_MS,
  mockGazeAt,
  mockGestureAt,
  mockPerceptionStateAt,
} from '../src';

describe('AE595 — mockGazeAt', () => {
  it('is deterministic for a given t', () => {
    expect(mockGazeAt(1234)).toEqual(mockGazeAt(1234));
  });
  it('keeps x/y within [0.1, 0.9] at steady confidence, stamping capturedAt', () => {
    for (let t = 0; t <= 8000; t += 250) {
      const g = mockGazeAt(t);
      expect(g.x).toBeGreaterThanOrEqual(0.1 - 1e-9);
      expect(g.x).toBeLessThanOrEqual(0.9 + 1e-9);
      expect(g.y).toBeGreaterThanOrEqual(0.1 - 1e-9);
      expect(g.y).toBeLessThanOrEqual(0.9 + 1e-9);
      expect(g.confidence).toBeCloseTo(0.9, 10);
      expect(g.capturedAt).toBe(t);
    }
  });
  it('is safe against non-finite / negative t (folds to t=0)', () => {
    expect(mockGazeAt(Number.NaN)).toEqual(mockGazeAt(0));
    expect(mockGazeAt(-500)).toEqual(mockGazeAt(0));
  });
});

describe('AE595 — mockGestureAt', () => {
  it('emits a gesture in the active slice and null after it', () => {
    expect(mockGestureAt(0)).not.toBeNull();
    expect(mockGestureAt(MOCK_GESTURE_ACTIVE_MS - 1)).not.toBeNull();
    expect(mockGestureAt(MOCK_GESTURE_ACTIVE_MS)).toBeNull(); // first quiet instant (>=)
    expect(mockGestureAt(MOCK_GESTURE_ACTIVE_MS + 1)).toBeNull();
    expect(mockGestureAt(MOCK_GESTURE_WINDOW_MS - 1)).toBeNull();
  });
  it('cycles the gesture across consecutive windows', () => {
    expect(mockGestureAt(0)?.gesture).toBe('open-palm');
    expect(mockGestureAt(MOCK_GESTURE_WINDOW_MS)?.gesture).toBe('pinch');
    expect(mockGestureAt(MOCK_GESTURE_WINDOW_MS * 2)?.gesture).toBe('wave');
    expect(mockGestureAt(MOCK_GESTURE_WINDOW_MS * 3)?.gesture).toBe('point');
    // wraps after the four gestures
    expect(mockGestureAt(MOCK_GESTURE_WINDOW_MS * 4)?.gesture).toBe('open-palm');
  });
});

describe('AE595 — mockPerceptionStateAt', () => {
  it('assembles an always-active frame from the gaze + gesture mocks', () => {
    const s = mockPerceptionStateAt(1500);
    expect(s.active).toBe(true);
    expect(s.gaze).toEqual(mockGazeAt(1500));
    expect(s.gesture).toEqual(mockGestureAt(1500));
  });
  it('is deterministic', () => {
    expect(mockPerceptionStateAt(4321)).toEqual(mockPerceptionStateAt(4321));
  });
});
