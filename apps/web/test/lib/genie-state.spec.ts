/** Vitest specs for AE406 Genie state machine. */
import { describe, expect, it } from 'vitest';
import {
  genieIsActive,
  genieMicAriaLabel,
  genieMicRingColor,
  genieOnError,
  genieOnMicPress,
  genieOnMicRelease,
  genieOnStt,
  genieReset,
  genieStateLabel,
  type GenieState,
} from '../../src/components/aether/phase2/genie-state';

const STATES: ReadonlyArray<GenieState> = [
  'idle',
  'listening',
  'processing',
  'transcribed',
  'error',
];

describe('genieStateLabel (pure)', () => {
  it('returns a non-empty string for every state', () => {
    for (const s of STATES) {
      expect(typeof genieStateLabel(s)).toBe('string');
      expect(genieStateLabel(s).length).toBeGreaterThan(0);
    }
  });
  it('idle copy invites the press', () => {
    expect(genieStateLabel('idle').toLowerCase()).toContain('hold');
  });
  it('listening copy says "Listening…"', () => {
    expect(genieStateLabel('listening')).toBe('Listening…');
  });
});

describe('genieMicAriaLabel (pure)', () => {
  it('every state has a verb-led action label', () => {
    for (const s of STATES) {
      const label = genieMicAriaLabel(s);
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });
  it('listening uses release verb', () => {
    expect(genieMicAriaLabel('listening').toLowerCase()).toContain('release');
  });
});

describe('genieMicRingColor (pure)', () => {
  it('idle/listening differ', () => {
    expect(genieMicRingColor('idle')).not.toBe(genieMicRingColor('listening'));
  });
  it('error returns a concrete fallback (no var)', () => {
    expect(genieMicRingColor('error')).toBe('#B0644A');
  });
});

describe('genieIsActive (pure)', () => {
  it('only listening + processing are active', () => {
    expect(genieIsActive('idle')).toBe(false);
    expect(genieIsActive('listening')).toBe(true);
    expect(genieIsActive('processing')).toBe(true);
    expect(genieIsActive('transcribed')).toBe(false);
    expect(genieIsActive('error')).toBe(false);
  });
});

describe('genieOnMicPress (pure)', () => {
  it('idle / transcribed / error → listening', () => {
    expect(genieOnMicPress('idle')).toBe('listening');
    expect(genieOnMicPress('transcribed')).toBe('listening');
    expect(genieOnMicPress('error')).toBe('listening');
  });
  it('already listening → no-op', () => {
    expect(genieOnMicPress('listening')).toBe('listening');
  });
  it('processing → no-op', () => {
    expect(genieOnMicPress('processing')).toBe('processing');
  });
});

describe('genieOnMicRelease (pure)', () => {
  it('listening → processing', () => {
    expect(genieOnMicRelease('listening')).toBe('processing');
  });
  it('other states → no-op', () => {
    expect(genieOnMicRelease('idle')).toBe('idle');
    expect(genieOnMicRelease('processing')).toBe('processing');
    expect(genieOnMicRelease('transcribed')).toBe('transcribed');
    expect(genieOnMicRelease('error')).toBe('error');
  });
});

describe('genieOnStt (pure)', () => {
  it('processing → transcribed', () => {
    expect(genieOnStt('processing')).toBe('transcribed');
  });
  it('other states → no-op', () => {
    expect(genieOnStt('idle')).toBe('idle');
    expect(genieOnStt('listening')).toBe('listening');
    expect(genieOnStt('transcribed')).toBe('transcribed');
  });
});

describe('genieOnError (pure)', () => {
  it('any non-idle state → error', () => {
    expect(genieOnError('listening')).toBe('error');
    expect(genieOnError('processing')).toBe('error');
    expect(genieOnError('transcribed')).toBe('error');
    expect(genieOnError('error')).toBe('error');
  });
  it('idle stays idle (nothing to error out of)', () => {
    expect(genieOnError('idle')).toBe('idle');
  });
});

describe('genieReset (pure)', () => {
  it('always returns idle', () => {
    expect(genieReset()).toBe('idle');
  });
});

describe('state machine — full success path', () => {
  it('idle → listening → processing → transcribed', () => {
    let s: GenieState = 'idle';
    s = genieOnMicPress(s);
    expect(s).toBe('listening');
    s = genieOnMicRelease(s);
    expect(s).toBe('processing');
    s = genieOnStt(s);
    expect(s).toBe('transcribed');
  });
});

describe('state machine — error path', () => {
  it('listening → error → reset → idle', () => {
    let s: GenieState = 'listening';
    s = genieOnError(s);
    expect(s).toBe('error');
    s = genieReset();
    expect(s).toBe('idle');
  });
});
