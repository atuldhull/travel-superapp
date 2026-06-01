/** Vitest specs for AE411 Genie recorder helpers. */
import { describe, expect, it } from 'vitest';
import {
  MAX_RECORDING_MS,
  RECORDER_MIME_PREFERENCES,
  RECORDER_TICK_MS,
  canStartRecording,
  formatRecordingDuration,
  genieMimeExtension,
  isRecorderBusy,
  pickAudioMimeType,
  recorderStatusLabel,
  shouldAutoStop,
  type GenieRecorderStatus,
} from '../../src/components/aether/phase2/genie-recorder';

describe('RECORDER constants (pure)', () => {
  it('MAX_RECORDING_MS is a sensible cap (≥ 30s, ≤ 5 min)', () => {
    expect(MAX_RECORDING_MS).toBeGreaterThanOrEqual(30_000);
    expect(MAX_RECORDING_MS).toBeLessThanOrEqual(300_000);
  });
  it('RECORDER_TICK_MS is human-friendly fine resolution', () => {
    expect(RECORDER_TICK_MS).toBeGreaterThan(0);
    expect(RECORDER_TICK_MS).toBeLessThanOrEqual(500);
  });
  it('RECORDER_MIME_PREFERENCES are ordered opus-first', () => {
    expect(RECORDER_MIME_PREFERENCES.length).toBeGreaterThan(0);
    expect(RECORDER_MIME_PREFERENCES[0]).toContain('opus');
    // Every preference is a non-empty audio MIME.
    for (const m of RECORDER_MIME_PREFERENCES) {
      expect(m).toMatch(/^audio\//);
    }
  });
});

describe('pickAudioMimeType (pure)', () => {
  it('returns null when nothing is supported', () => {
    expect(pickAudioMimeType(() => false)).toBeNull();
  });
  it('returns the first supported preference', () => {
    const supported = new Set(['audio/webm', 'audio/mp4']);
    expect(pickAudioMimeType((m) => supported.has(m))).toBe('audio/webm');
  });
  it('returns opus when supported (highest preference)', () => {
    expect(pickAudioMimeType(() => true)).toBe('audio/webm;codecs=opus');
  });
  it('falls through to mp4 when webm is unsupported (Safari path)', () => {
    expect(pickAudioMimeType((m) => m === 'audio/mp4')).toBe('audio/mp4');
  });
  it('honours custom preferences array', () => {
    expect(pickAudioMimeType(() => true, ['audio/foo', 'audio/bar'])).toBe('audio/foo');
  });
});

describe('formatRecordingDuration (pure)', () => {
  it('formats sub-second as 0:00', () => {
    expect(formatRecordingDuration(0)).toBe('0:00');
    expect(formatRecordingDuration(499)).toBe('0:00');
    expect(formatRecordingDuration(999)).toBe('0:00');
  });
  it('rounds DOWN to the second (no early bump)', () => {
    expect(formatRecordingDuration(1000)).toBe('0:01');
    expect(formatRecordingDuration(1999)).toBe('0:01');
  });
  it('zero-pads seconds below 10', () => {
    expect(formatRecordingDuration(9_000)).toBe('0:09');
  });
  it('crosses the minute boundary cleanly', () => {
    expect(formatRecordingDuration(60_000)).toBe('1:00');
    expect(formatRecordingDuration(83_000)).toBe('1:23');
  });
  it('does not zero-pad minutes (we expect ≤ a few minutes)', () => {
    expect(formatRecordingDuration(600_000)).toBe('10:00');
  });
  it('NaN / Infinity / negative all collapse to 0:00', () => {
    expect(formatRecordingDuration(Number.NaN)).toBe('0:00');
    expect(formatRecordingDuration(Number.POSITIVE_INFINITY)).toBe('0:00');
    expect(formatRecordingDuration(Number.NEGATIVE_INFINITY)).toBe('0:00');
    expect(formatRecordingDuration(-1000)).toBe('0:00');
  });
});

describe('shouldAutoStop (pure)', () => {
  it('false below the cap', () => {
    expect(shouldAutoStop(0)).toBe(false);
    expect(shouldAutoStop(MAX_RECORDING_MS - 1)).toBe(false);
  });
  it('true at the cap (inclusive)', () => {
    expect(shouldAutoStop(MAX_RECORDING_MS)).toBe(true);
  });
  it('true past the cap', () => {
    expect(shouldAutoStop(MAX_RECORDING_MS + 1)).toBe(true);
  });
  it('honours a custom cap', () => {
    expect(shouldAutoStop(5_000, 10_000)).toBe(false);
    expect(shouldAutoStop(10_001, 10_000)).toBe(true);
  });
  it('NaN / Infinity short-circuit to false (no auto-stop without a clock)', () => {
    expect(shouldAutoStop(Number.NaN)).toBe(false);
  });
});

describe('recorderStatusLabel (pure)', () => {
  const cases: Array<[GenieRecorderStatus, string]> = [
    ['idle', 'Microphone ready'],
    ['requesting', 'Requesting microphone permission'],
    ['stopping', 'Finalising recording'],
    ['error', 'Microphone error'],
  ];
  for (const [status, label] of cases) {
    it(`${status} → "${label}"`, () => {
      expect(recorderStatusLabel(status)).toBe(label);
    });
  }
  it('recording label folds in the duration', () => {
    expect(recorderStatusLabel('recording', 5_000)).toBe('Recording, 0:05');
  });
  it('stopped label folds in the duration', () => {
    expect(recorderStatusLabel('stopped', 12_000)).toBe('Recorded 0:12');
  });
});

describe('isRecorderBusy (pure)', () => {
  it('busy for requesting / recording / stopping', () => {
    expect(isRecorderBusy('requesting')).toBe(true);
    expect(isRecorderBusy('recording')).toBe(true);
    expect(isRecorderBusy('stopping')).toBe(true);
  });
  it('not busy for idle / stopped / error', () => {
    expect(isRecorderBusy('idle')).toBe(false);
    expect(isRecorderBusy('stopped')).toBe(false);
    expect(isRecorderBusy('error')).toBe(false);
  });
});

describe('canStartRecording (pure)', () => {
  it('safe to start when idle / stopped / error', () => {
    expect(canStartRecording('idle')).toBe(true);
    expect(canStartRecording('stopped')).toBe(true);
    expect(canStartRecording('error')).toBe(true);
  });
  it('blocked when requesting / recording / stopping', () => {
    expect(canStartRecording('requesting')).toBe(false);
    expect(canStartRecording('recording')).toBe(false);
    expect(canStartRecording('stopping')).toBe(false);
  });
});

describe('genieMimeExtension (AE451)', () => {
  it('null / undefined / empty → "webm" default', () => {
    expect(genieMimeExtension(null)).toBe('webm');
    expect(genieMimeExtension(undefined)).toBe('webm');
    expect(genieMimeExtension('')).toBe('webm');
  });
  it('audio/webm (with codec param) → "webm"', () => {
    expect(genieMimeExtension('audio/webm')).toBe('webm');
    expect(genieMimeExtension('audio/webm;codecs=opus')).toBe('webm');
  });
  it('audio/mp4 family → "m4a"', () => {
    expect(genieMimeExtension('audio/mp4')).toBe('m4a');
    expect(genieMimeExtension('audio/mp4;codecs=mp4a.40.2')).toBe('m4a');
    expect(genieMimeExtension('audio/aac')).toBe('m4a');
    expect(genieMimeExtension('audio/mp4a-latm')).toBe('m4a');
  });
  it('audio/ogg + codecs → "ogg"', () => {
    expect(genieMimeExtension('audio/ogg')).toBe('ogg');
    expect(genieMimeExtension('audio/ogg;codecs=opus')).toBe('ogg');
  });
  it('wav variants → "wav"', () => {
    expect(genieMimeExtension('audio/wav')).toBe('wav');
    expect(genieMimeExtension('audio/wave')).toBe('wav');
    expect(genieMimeExtension('audio/x-wav')).toBe('wav');
  });
  it('mp3 variants → "mp3"', () => {
    expect(genieMimeExtension('audio/mpeg')).toBe('mp3');
    expect(genieMimeExtension('audio/mp3')).toBe('mp3');
  });
  it('case-insensitive', () => {
    expect(genieMimeExtension('AUDIO/WEBM')).toBe('webm');
    expect(genieMimeExtension('Audio/Mp4')).toBe('m4a');
  });
  it('unknown MIME falls back to "webm"', () => {
    expect(genieMimeExtension('application/octet-stream')).toBe('webm');
    expect(genieMimeExtension('text/plain')).toBe('webm');
  });
});
