/**
 * AE501 â€” canvas-shared own behavioural spec for `genie-recorder`.
 *
 * Pins the AE411 MediaRecorder capture helpers: the six-state recorder
 * status union, the 60 s hard cap + 100 ms tick constants, the frozen
 * mime preference list, and every branch in pickAudioMimeType /
 * formatRecordingDuration / shouldAutoStop / recorderStatusLabel /
 * isRecorderBusy / canStartRecording / genieMimeExtension so the
 * Phase 4 native modal can re-export the same contract.
 */
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
} from '../src';

const ALL_STATUSES: GenieRecorderStatus[] = [
  'idle',
  'requesting',
  'recording',
  'stopping',
  'stopped',
  'error',
];

describe('AE501 â€” recorder constants', () => {
  it('MAX_RECORDING_MS is the one-minute hard cap', () => {
    expect(MAX_RECORDING_MS).toBe(60_000);
  });
  it('RECORDER_TICK_MS is 100 ms for the UI counter', () => {
    expect(RECORDER_TICK_MS).toBe(100);
  });
  it('RECORDER_MIME_PREFERENCES is a frozen non-empty list', () => {
    expect(Array.isArray(RECORDER_MIME_PREFERENCES)).toBe(true);
    expect(RECORDER_MIME_PREFERENCES.length).toBeGreaterThan(0);
    expect(Object.isFrozen(RECORDER_MIME_PREFERENCES)).toBe(true);
  });
  it('RECORDER_MIME_PREFERENCES leads with opus-in-webm (best bitrate / latency)', () => {
    expect(RECORDER_MIME_PREFERENCES[0]).toBe('audio/webm;codecs=opus');
  });
  it('RECORDER_MIME_PREFERENCES includes the Safari mp4 fallback', () => {
    expect(RECORDER_MIME_PREFERENCES).toContain('audio/mp4');
  });
});

describe('AE501 â€” pickAudioMimeType', () => {
  it('returns the first preference the predicate accepts', () => {
    const picked = pickAudioMimeType(() => true);
    expect(picked).toBe(RECORDER_MIME_PREFERENCES[0]);
  });
  it('skips rejected entries and returns the first accepted one', () => {
    const picked = pickAudioMimeType((mime) => mime === 'audio/mp4');
    expect(picked).toBe('audio/mp4');
  });
  it('returns null when nothing is supported', () => {
    expect(pickAudioMimeType(() => false)).toBeNull();
  });
  it('respects a custom preference list when provided', () => {
    const picked = pickAudioMimeType(() => true, ['audio/wav', 'audio/ogg']);
    expect(picked).toBe('audio/wav');
  });
  it('returns null for an empty preference list', () => {
    expect(pickAudioMimeType(() => true, [])).toBeNull();
  });
});

describe('AE501 â€” formatRecordingDuration', () => {
  it('formats zero as 0:00', () => {
    expect(formatRecordingDuration(0)).toBe('0:00');
  });
  it('pads single-digit seconds with a leading zero', () => {
    expect(formatRecordingDuration(3_000)).toBe('0:03');
  });
  it('does not pad double-digit seconds', () => {
    expect(formatRecordingDuration(42_000)).toBe('0:42');
  });
  it('rolls over to the next minute at 60 s exactly', () => {
    expect(formatRecordingDuration(60_000)).toBe('1:00');
  });
  it('formats sub-second residue by flooring', () => {
    expect(formatRecordingDuration(1_999)).toBe('0:01');
  });
  it('collapses negative input to 0:00', () => {
    expect(formatRecordingDuration(-5_000)).toBe('0:00');
  });
  it('collapses NaN to 0:00', () => {
    expect(formatRecordingDuration(Number.NaN)).toBe('0:00');
  });
  it('collapses Infinity to 0:00', () => {
    expect(formatRecordingDuration(Number.POSITIVE_INFINITY)).toBe('0:00');
  });
});

describe('AE501 â€” shouldAutoStop', () => {
  it('is false just below the cap (boundary -1)', () => {
    expect(shouldAutoStop(MAX_RECORDING_MS - 1)).toBe(false);
  });
  it('is true exactly at the cap (boundary)', () => {
    expect(shouldAutoStop(MAX_RECORDING_MS)).toBe(true);
  });
  it('is true past the cap', () => {
    expect(shouldAutoStop(MAX_RECORDING_MS + 1_000)).toBe(true);
  });
  it('honours a custom maxMs override', () => {
    expect(shouldAutoStop(5_000, 4_000)).toBe(true);
    expect(shouldAutoStop(3_999, 4_000)).toBe(false);
  });
  it('returns false for non-finite elapsed input', () => {
    expect(shouldAutoStop(Number.NaN)).toBe(false);
    expect(shouldAutoStop(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe('AE501 â€” recorderStatusLabel', () => {
  it('idle mentions ready', () => {
    expect(recorderStatusLabel('idle')).toMatch(/ready/i);
  });
  it('requesting mentions permission', () => {
    expect(recorderStatusLabel('requesting')).toMatch(/permission/i);
  });
  it('recording embeds the live duration', () => {
    expect(recorderStatusLabel('recording', 7_000)).toMatch(/0:07/);
    expect(recorderStatusLabel('recording', 7_000)).toMatch(/recording/i);
  });
  it('stopping mentions finalising', () => {
    expect(recorderStatusLabel('stopping')).toMatch(/finalis|final/i);
  });
  it('stopped embeds the final duration', () => {
    expect(recorderStatusLabel('stopped', 12_000)).toMatch(/0:12/);
    expect(recorderStatusLabel('stopped', 12_000)).toMatch(/recorded/i);
  });
  it('error mentions an error', () => {
    expect(recorderStatusLabel('error')).toMatch(/error/i);
  });
  it('returns a non-empty label for every status (default duration)', () => {
    for (const s of ALL_STATUSES) {
      expect(recorderStatusLabel(s).length).toBeGreaterThan(0);
    }
  });
});

describe('AE501 â€” isRecorderBusy', () => {
  it('is true for requesting + recording + stopping', () => {
    expect(isRecorderBusy('requesting')).toBe(true);
    expect(isRecorderBusy('recording')).toBe(true);
    expect(isRecorderBusy('stopping')).toBe(true);
  });
  it('is false for idle + stopped + error', () => {
    expect(isRecorderBusy('idle')).toBe(false);
    expect(isRecorderBusy('stopped')).toBe(false);
    expect(isRecorderBusy('error')).toBe(false);
  });
});

describe('AE501 â€” canStartRecording', () => {
  it('is true for idle + stopped + error (safe to start again)', () => {
    expect(canStartRecording('idle')).toBe(true);
    expect(canStartRecording('stopped')).toBe(true);
    expect(canStartRecording('error')).toBe(true);
  });
  it('is false for requesting + recording + stopping (busy already)', () => {
    expect(canStartRecording('requesting')).toBe(false);
    expect(canStartRecording('recording')).toBe(false);
    expect(canStartRecording('stopping')).toBe(false);
  });
  it('is the exact inverse of isRecorderBusy for every status', () => {
    for (const s of ALL_STATUSES) {
      expect(canStartRecording(s)).toBe(!isRecorderBusy(s));
    }
  });
});

describe('AE501 â€” genieMimeExtension', () => {
  it('maps audio/webm to webm', () => {
    expect(genieMimeExtension('audio/webm')).toBe('webm');
  });
  it('maps audio/webm;codecs=opus to webm (codec param stripped)', () => {
    expect(genieMimeExtension('audio/webm;codecs=opus')).toBe('webm');
  });
  it('maps the mp4 family (mp4 / mp4a-latm / aac) to m4a', () => {
    expect(genieMimeExtension('audio/mp4')).toBe('m4a');
    expect(genieMimeExtension('audio/mp4a-latm')).toBe('m4a');
    expect(genieMimeExtension('audio/aac')).toBe('m4a');
  });
  it('maps audio/ogg (with or without codec) to ogg', () => {
    expect(genieMimeExtension('audio/ogg')).toBe('ogg');
    expect(genieMimeExtension('audio/ogg;codecs=opus')).toBe('ogg');
  });
  it('maps the wav family (wav / wave / x-wav) to wav', () => {
    expect(genieMimeExtension('audio/wav')).toBe('wav');
    expect(genieMimeExtension('audio/wave')).toBe('wav');
    expect(genieMimeExtension('audio/x-wav')).toBe('wav');
  });
  it('maps the mp3 family (mpeg / mp3) to mp3', () => {
    expect(genieMimeExtension('audio/mpeg')).toBe('mp3');
    expect(genieMimeExtension('audio/mp3')).toBe('mp3');
  });
  it('is case-insensitive on the mime token', () => {
    expect(genieMimeExtension('AUDIO/WEBM')).toBe('webm');
    expect(genieMimeExtension('Audio/Mp4')).toBe('m4a');
  });
  it('trims whitespace around the codec-stripped token', () => {
    expect(genieMimeExtension('  audio/webm  ;codecs=opus')).toBe('webm');
  });
  it('falls back to webm for empty string', () => {
    expect(genieMimeExtension('')).toBe('webm');
  });
  it('falls back to webm for null + undefined', () => {
    expect(genieMimeExtension(null)).toBe('webm');
    expect(genieMimeExtension(undefined)).toBe('webm');
  });
  it('falls back to webm for unknown mime types', () => {
    expect(genieMimeExtension('audio/flac')).toBe('webm');
    expect(genieMimeExtension('video/mp4')).toBe('webm');
  });
});
