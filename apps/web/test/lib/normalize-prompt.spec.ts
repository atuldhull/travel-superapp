/**
 * Vitest specs for AE207 normalizePulsePrompt — the Pulse composer
 * input normaliser.
 */
import { describe, expect, it } from 'vitest';
import {
  PULSE_PROMPT_MAX,
  normalizePulsePrompt,
} from '../../src/components/aether/pulse/normalize-prompt';

describe('normalizePulsePrompt', () => {
  it('accepts a plain trimmed sentence', () => {
    const got = normalizePulsePrompt('plan two days in Leh');
    expect(got).toEqual({ ok: true, text: 'plan two days in Leh' });
  });

  it('trims leading + trailing whitespace', () => {
    const got = normalizePulsePrompt('  hello world  ');
    expect(got).toEqual({ ok: true, text: 'hello world' });
  });

  it('rejects empty string', () => {
    expect(normalizePulsePrompt('')).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects whitespace-only input as empty', () => {
    expect(normalizePulsePrompt('   \n\t  ')).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects strings longer than PULSE_PROMPT_MAX', () => {
    const tooLong = 'x'.repeat(PULSE_PROMPT_MAX + 1);
    expect(normalizePulsePrompt(tooLong)).toEqual({ ok: false, reason: 'too-long' });
  });

  it('accepts exactly PULSE_PROMPT_MAX chars (boundary)', () => {
    const justRight = 'x'.repeat(PULSE_PROMPT_MAX);
    expect(normalizePulsePrompt(justRight)).toEqual({ ok: true, text: justRight });
  });

  it('does NOT collapse internal whitespace (preserves multi-word spacing)', () => {
    const got = normalizePulsePrompt('two   spaces inside');
    expect(got).toEqual({ ok: true, text: 'two   spaces inside' });
  });

  it('PULSE_PROMPT_MAX is a sane upper-bound (≥1024)', () => {
    expect(PULSE_PROMPT_MAX).toBeGreaterThanOrEqual(1024);
  });
});
