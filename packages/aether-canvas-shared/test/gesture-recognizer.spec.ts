/**
 * AE594 — behavioural spec for `gesture-recognizer`.
 *
 * Pins the anti-jitter contract: fire once after N consecutive confident
 * frames, never re-fire while held, reset on drop / change, the
 * holdFrames=1 + floored-holdFrames cases, the low-confidence reset, and
 * the bounded held count.
 */
import {
  INITIAL_GESTURE_RECOGNIZER_STATE,
  advanceGestureRecognizer,
  type GestureEvent,
  type GestureRecognizerState,
} from '../src';

const ev = (gesture: GestureEvent['gesture'], confidence = 0.9): GestureEvent => ({
  gesture,
  confidence,
  capturedAt: 0,
});

/** Fold a sequence of events through the recognizer (default options). */
function run(
  events: Array<GestureEvent | null>,
  options?: Parameters<typeof advanceGestureRecognizer>[2],
): GestureRecognizerState[] {
  const states: GestureRecognizerState[] = [];
  let s = INITIAL_GESTURE_RECOGNIZER_STATE;
  for (const e of events) {
    s = advanceGestureRecognizer(s, e, options);
    states.push(s);
  }
  return states;
}

describe('AE594 — advanceGestureRecognizer', () => {
  it('fires once on the frame the hold reaches the threshold (default 3)', () => {
    const states = run([ev('pinch'), ev('pinch'), ev('pinch'), ev('pinch')]);
    expect(states.map((s) => s.fired)).toEqual([null, null, 'pinch', null]);
    expect(states[2]?.heldFrames).toBe(3);
  });

  it('caps heldFrames just past the threshold (bounded state)', () => {
    const states = run(Array.from({ length: 10 }, () => ev('pinch')));
    for (const s of states) {
      expect(s.heldFrames).toBeLessThanOrEqual(4); // threshold(3) + 1
    }
  });

  it('resets on a null frame (gesture dropped)', () => {
    const after = advanceGestureRecognizer(
      { candidate: 'pinch', heldFrames: 2, fired: null, hasFired: false },
      null,
    );
    expect(after).toEqual({ candidate: null, heldFrames: 0, fired: null, hasFired: false });
  });

  it('restarts the hold when the gesture changes', () => {
    const after = advanceGestureRecognizer(
      { candidate: 'pinch', heldFrames: 2, fired: null, hasFired: false },
      ev('wave'),
    );
    expect(after).toEqual({ candidate: 'wave', heldFrames: 1, fired: null, hasFired: false });
  });

  it('treats a low-confidence frame as no gesture (resets)', () => {
    const after = advanceGestureRecognizer(
      { candidate: 'pinch', heldFrames: 2, fired: null, hasFired: false },
      ev('pinch', 0.2),
    );
    expect(after.candidate).toBeNull();
    expect(after.fired).toBeNull();
  });

  it('uses the default minConfidence (0.6) floor', () => {
    // 0.55 < 0.6 resets; 0.65 >= 0.6 counts as a held candidate.
    expect(
      advanceGestureRecognizer(INITIAL_GESTURE_RECOGNIZER_STATE, ev('pinch', 0.55)).candidate,
    ).toBeNull();
    expect(
      advanceGestureRecognizer(INITIAL_GESTURE_RECOGNIZER_STATE, ev('pinch', 0.65)).candidate,
    ).toBe('pinch');
  });

  it('fires exactly once even if holdFrames changes mid-hold', () => {
    const fold = (frames: Array<{ o: { holdFrames: number } }>): Array<string | null> => {
      let s = INITIAL_GESTURE_RECOGNIZER_STATE;
      return frames.map(({ o }) => (s = advanceGestureRecognizer(s, ev('pinch'), o)).fired);
    };
    // RAISE the threshold mid-hold (2,2,4,4) — must not double-fire.
    expect(
      fold([
        { o: { holdFrames: 2 } },
        { o: { holdFrames: 2 } },
        { o: { holdFrames: 4 } },
        { o: { holdFrames: 4 } },
      ]).filter(Boolean),
    ).toEqual(['pinch']);
    // LOWER the threshold mid-hold (3,3,2,2) — must still fire once.
    expect(
      fold([
        { o: { holdFrames: 3 } },
        { o: { holdFrames: 3 } },
        { o: { holdFrames: 2 } },
        { o: { holdFrames: 2 } },
      ]).filter(Boolean),
    ).toEqual(['pinch']);
  });

  it('can fire the same gesture again after a reset', () => {
    const fired = run([
      ev('pinch'),
      ev('pinch'),
      ev('pinch'), // fires
      null, // reset
      ev('pinch'),
      ev('pinch'),
      ev('pinch'), // fires again
    ]).map((s) => s.fired);
    expect(fired).toEqual([null, null, 'pinch', null, null, null, 'pinch']);
  });

  it('fires immediately with holdFrames=1', () => {
    const s = advanceGestureRecognizer(INITIAL_GESTURE_RECOGNIZER_STATE, ev('point'), {
      holdFrames: 1,
    });
    expect(s.fired).toBe('point');
  });

  it('floors a < 1 or non-finite holdFrames to 1', () => {
    expect(
      advanceGestureRecognizer(INITIAL_GESTURE_RECOGNIZER_STATE, ev('point'), { holdFrames: 0 })
        .fired,
    ).toBe('point');
    expect(
      advanceGestureRecognizer(INITIAL_GESTURE_RECOGNIZER_STATE, ev('point'), {
        holdFrames: Number.NaN,
      }).fired,
    ).toBe('point');
  });
});
