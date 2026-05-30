/**
 * Vitest specs for AE290 voiceStateLabel + voiceStateAriaLive.
 */
import { describe, expect, it } from 'vitest';
import {
  voiceStateAriaLive,
  voiceStateLabel,
} from '../../src/components/aether/pulse/voice-state-label';

describe('voiceStateLabel', () => {
  it('idle → Hold to speak', () => {
    expect(voiceStateLabel('idle')).toBe('Hold to speak');
  });
  it('listening → …listening', () => {
    expect(voiceStateLabel('listening')).toBe('…listening');
  });
  it('thinking → thinking…', () => {
    expect(voiceStateLabel('thinking')).toBe('thinking…');
  });
  it('error → "Mic off — tap to retry"', () => {
    expect(voiceStateLabel('error')).toBe('Mic off — tap to retry');
  });
  it('denied → "Mic permission denied"', () => {
    expect(voiceStateLabel('denied')).toBe('Mic permission denied');
  });
  it('all 5 labels distinct', () => {
    const all = new Set([
      voiceStateLabel('idle'),
      voiceStateLabel('listening'),
      voiceStateLabel('thinking'),
      voiceStateLabel('error'),
      voiceStateLabel('denied'),
    ]);
    expect(all.size).toBe(5);
  });
});

describe('voiceStateAriaLive', () => {
  it('idle → off', () => {
    expect(voiceStateAriaLive('idle')).toBe('off');
  });
  it('listening + thinking → polite', () => {
    expect(voiceStateAriaLive('listening')).toBe('polite');
    expect(voiceStateAriaLive('thinking')).toBe('polite');
  });
  it('error + denied → assertive', () => {
    expect(voiceStateAriaLive('error')).toBe('assertive');
    expect(voiceStateAriaLive('denied')).toBe('assertive');
  });
});
