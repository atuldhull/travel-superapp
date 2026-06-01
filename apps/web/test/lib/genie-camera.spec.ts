/** Vitest specs for AE413 Genie camera helpers. */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CAMERA_FACING_MODE,
  DEFAULT_CAPTURE_QUALITY,
  DETECTION_PLACEHOLDER_LABEL,
  GENIE_CAPTURE_MODES,
  cameraStatusLabel,
  canCaptureStill,
  canStartCamera,
  captureModeDescription,
  captureModeGlyph,
  captureModeLabel,
  formatDetectionLabel,
  isCameraStreaming,
  type GenieCameraStatus,
  type GenieCaptureMode,
} from '../../src/components/aether/phase2/genie-camera';

describe('GENIE_CAPTURE_MODES (pure)', () => {
  it('lists voice + camera in that order', () => {
    expect(GENIE_CAPTURE_MODES).toEqual(['voice', 'camera']);
  });
});

describe('captureModeLabel + glyph + description (pure)', () => {
  it('every mode has a label, glyph, and description', () => {
    for (const m of GENIE_CAPTURE_MODES) {
      expect(captureModeLabel(m).length).toBeGreaterThan(0);
      expect(captureModeGlyph(m).length).toBeGreaterThan(0);
      expect(captureModeDescription(m).length).toBeGreaterThan(10);
    }
  });
  it('camera description honestly names the ML-Kit gap', () => {
    expect(captureModeDescription('camera').toLowerCase()).toContain('later');
  });
});

describe('cameraStatusLabel (pure)', () => {
  const cases: Array<[GenieCameraStatus, string]> = [
    ['idle', 'Camera ready'],
    ['requesting', 'Requesting camera permission'],
    ['streaming', 'Camera live, ready to capture'],
    ['captured', 'Still captured'],
    ['error', 'Camera error'],
  ];
  for (const [s, label] of cases) {
    it(`${s} → "${label}"`, () => {
      expect(cameraStatusLabel(s)).toBe(label);
    });
  }
});

describe('isCameraStreaming (pure)', () => {
  it('only streaming returns true', () => {
    expect(isCameraStreaming('streaming')).toBe(true);
    for (const s of ['idle', 'requesting', 'captured', 'error'] as GenieCameraStatus[]) {
      expect(isCameraStreaming(s)).toBe(false);
    }
  });
});

describe('canCaptureStill (pure)', () => {
  it('only allowed while streaming', () => {
    expect(canCaptureStill('streaming')).toBe(true);
    for (const s of ['idle', 'requesting', 'captured', 'error'] as GenieCameraStatus[]) {
      expect(canCaptureStill(s)).toBe(false);
    }
  });
});

describe('canStartCamera (pure)', () => {
  it('safe at idle / captured / error', () => {
    expect(canStartCamera('idle')).toBe(true);
    expect(canStartCamera('captured')).toBe(true);
    expect(canStartCamera('error')).toBe(true);
  });
  it('blocked while requesting / streaming', () => {
    expect(canStartCamera('requesting')).toBe(false);
    expect(canStartCamera('streaming')).toBe(false);
  });
});

describe('formatDetectionLabel (pure)', () => {
  it('formats label with rounded percent', () => {
    expect(formatDetectionLabel('Coconut tree', 0.87)).toBe('Coconut tree (87%)');
  });
  it('clamps below 0 to 0%', () => {
    expect(formatDetectionLabel('Sky', -0.3)).toBe('Sky (0%)');
  });
  it('clamps above 1 to 100%', () => {
    expect(formatDetectionLabel('Sky', 1.5)).toBe('Sky (100%)');
  });
  it('falls back to bare label for NaN', () => {
    expect(formatDetectionLabel('Sky', Number.NaN)).toBe('Sky');
  });
  it('rounds to the nearest percent', () => {
    expect(formatDetectionLabel('Bird', 0.499)).toBe('Bird (50%)');
    expect(formatDetectionLabel('Bird', 0.4999)).toBe('Bird (50%)');
  });
});

describe('constants (pure)', () => {
  it('default facing mode favours the rear camera', () => {
    expect(DEFAULT_CAMERA_FACING_MODE).toBe('environment');
  });
  it('default capture quality is a sensible jpeg level', () => {
    expect(DEFAULT_CAPTURE_QUALITY).toBeGreaterThanOrEqual(0.6);
    expect(DEFAULT_CAPTURE_QUALITY).toBeLessThanOrEqual(1);
  });
  it('detection placeholder is honest about the ML-Kit gap', () => {
    expect(DETECTION_PLACEHOLDER_LABEL.toLowerCase()).toContain('later');
  });
});

describe('GenieCaptureMode + GenieCameraStatus types (pure)', () => {
  it('round-trip every mode through label + glyph', () => {
    for (const m of GENIE_CAPTURE_MODES as ReadonlyArray<GenieCaptureMode>) {
      expect(typeof captureModeLabel(m)).toBe('string');
      expect(typeof captureModeGlyph(m)).toBe('string');
    }
  });
});
