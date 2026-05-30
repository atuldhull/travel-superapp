/**
 * AE290 — pure label routing for the AE59 Pulse voice-input states.
 *
 * Voice surface has 5 visible states. Today the label is set
 * inside the hook with switch statements. This helper canonicalises:
 *
 *   idle      → 'Hold to speak'
 *   listening → '…listening'
 *   thinking  → 'thinking…'
 *   error     → 'Mic off — tap to retry'
 *   denied    → 'Mic permission denied'
 */

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'error' | 'denied';

const LABELS: Record<VoiceState, string> = {
  idle: 'Hold to speak',
  listening: '…listening',
  thinking: 'thinking…',
  error: 'Mic off — tap to retry',
  denied: 'Mic permission denied',
};

export function voiceStateLabel(state: VoiceState): string {
  return LABELS[state];
}

export function voiceStateAriaLive(state: VoiceState): 'polite' | 'assertive' | 'off' {
  if (state === 'error' || state === 'denied') return 'assertive';
  if (state === 'idle') return 'off';
  return 'polite';
}
