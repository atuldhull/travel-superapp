/**
 * AE492 — canvas-shared own behavioural spec for `genie-state`.
 *
 * Pins the five-state FSM (idle / listening / processing / transcribed
 * / error), the press/release transitions, the STT-complete + error
 * sinks, and every label/aria/ring-color branch so the Phase 4
 * native modal can re-export the same FSM and trust the contract.
 */
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
} from '../src';

const ALL_STATES: GenieState[] = ['idle', 'listening', 'processing', 'transcribed', 'error'];

describe('AE492 — genieStateLabel', () => {
  it('returns a non-empty headline for every state', () => {
    for (const s of ALL_STATES) {
      expect(genieStateLabel(s).length).toBeGreaterThan(0);
    }
  });
  it('uses the canonical hold-to-talk copy on idle', () => {
    expect(genieStateLabel('idle')).toBe('Hold to talk');
  });
  it('signals the listening + processing + transcribed cases distinctly', () => {
    expect(genieStateLabel('listening')).toMatch(/listening/i);
    expect(genieStateLabel('processing')).toMatch(/reading|process|thinking/i);
    expect(genieStateLabel('transcribed')).toMatch(/got it|done|ready/i);
  });
  it('error copy is apologetic + acknowledges the interruption', () => {
    expect(genieStateLabel('error')).toMatch(/sorry/i);
  });
});

describe('AE492 — genieMicAriaLabel', () => {
  it('is action-verb shaped (starts with a verb) for every state', () => {
    for (const s of ALL_STATES) {
      const label = genieMicAriaLabel(s);
      expect(label.length).toBeGreaterThan(0);
      expect(label[0]).toMatch(/[A-Z]/);
    }
  });
  it('idle copy mentions press-and-hold', () => {
    expect(genieMicAriaLabel('idle')).toMatch(/press.*hold/i);
  });
  it('listening copy mentions release', () => {
    expect(genieMicAriaLabel('listening')).toMatch(/release/i);
  });
  it('error copy mentions retry', () => {
    expect(genieMicAriaLabel('error')).toMatch(/retry/i);
  });
});

describe('AE492 — genieMicRingColor', () => {
  it('returns a non-empty CSS-var or hex string for every state', () => {
    for (const s of ALL_STATES) {
      const c = genieMicRingColor(s);
      expect(c.length).toBeGreaterThan(0);
    }
  });
  it('idle reads the accent palette slot', () => {
    expect(genieMicRingColor('idle')).toMatch(/--aether-palette-accent/);
  });
  it('listening + transcribed both read the glow palette slot', () => {
    expect(genieMicRingColor('listening')).toMatch(/--aether-palette-glow/);
    expect(genieMicRingColor('transcribed')).toMatch(/--aether-palette-glow/);
  });
  it('processing reads the support palette slot', () => {
    expect(genieMicRingColor('processing')).toMatch(/--aether-palette-support/);
  });
  it('error returns a raw hex (no palette dependency)', () => {
    expect(genieMicRingColor('error')).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe('AE492 — genieIsActive', () => {
  it('returns true only for listening + processing', () => {
    expect(genieIsActive('idle')).toBe(false);
    expect(genieIsActive('listening')).toBe(true);
    expect(genieIsActive('processing')).toBe(true);
    expect(genieIsActive('transcribed')).toBe(false);
    expect(genieIsActive('error')).toBe(false);
  });
});

describe('AE492 — genieOnMicPress', () => {
  it('idle + transcribed + error transition to listening on press', () => {
    expect(genieOnMicPress('idle')).toBe('listening');
    expect(genieOnMicPress('transcribed')).toBe('listening');
    expect(genieOnMicPress('error')).toBe('listening');
  });
  it('listening + processing are no-ops on press', () => {
    expect(genieOnMicPress('listening')).toBe('listening');
    expect(genieOnMicPress('processing')).toBe('processing');
  });
});

describe('AE492 — genieOnMicRelease', () => {
  it('listening transitions to processing on release', () => {
    expect(genieOnMicRelease('listening')).toBe('processing');
  });
  it('every other state is a no-op on release', () => {
    expect(genieOnMicRelease('idle')).toBe('idle');
    expect(genieOnMicRelease('processing')).toBe('processing');
    expect(genieOnMicRelease('transcribed')).toBe('transcribed');
    expect(genieOnMicRelease('error')).toBe('error');
  });
});

describe('AE492 — genieOnStt', () => {
  it('processing transitions to transcribed on STT success', () => {
    expect(genieOnStt('processing')).toBe('transcribed');
  });
  it('every other state is a no-op on STT success', () => {
    expect(genieOnStt('idle')).toBe('idle');
    expect(genieOnStt('listening')).toBe('listening');
    expect(genieOnStt('transcribed')).toBe('transcribed');
    expect(genieOnStt('error')).toBe('error');
  });
});

describe('AE492 — genieOnError', () => {
  it('idle stays idle on error (modal never opened)', () => {
    expect(genieOnError('idle')).toBe('idle');
  });
  it('every non-idle state transitions to error', () => {
    expect(genieOnError('listening')).toBe('error');
    expect(genieOnError('processing')).toBe('error');
    expect(genieOnError('transcribed')).toBe('error');
    expect(genieOnError('error')).toBe('error');
  });
});

describe('AE492 — genieReset', () => {
  it('always returns idle', () => {
    expect(genieReset()).toBe('idle');
  });
});

describe('AE492 — happy-path traversal', () => {
  it('walks idle → listening → processing → transcribed', () => {
    let s: GenieState = 'idle';
    s = genieOnMicPress(s);
    expect(s).toBe('listening');
    s = genieOnMicRelease(s);
    expect(s).toBe('processing');
    s = genieOnStt(s);
    expect(s).toBe('transcribed');
  });
  it('reset path returns to idle from anywhere', () => {
    for (const _s of ALL_STATES) {
      expect(genieReset()).toBe('idle');
    }
  });
  it('error from listening + retry returns to listening', () => {
    let s: GenieState = 'listening';
    s = genieOnError(s);
    expect(s).toBe('error');
    s = genieOnMicPress(s);
    expect(s).toBe('listening');
  });
});
