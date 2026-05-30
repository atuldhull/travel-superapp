/**
 * Vitest specs for AE266 shouldShowThinkingDot.
 */
import { describe, expect, it } from 'vitest';
import {
  MIN_THINKING_MS,
  shouldShowThinkingDot,
} from '../../src/components/aether/pulse/should-show-thinking-dot';

describe('shouldShowThinkingDot', () => {
  it('pending=false → never', () => {
    expect(shouldShowThinkingDot({ pending: false, elapsedMs: 9999, composerHasText: false })).toBe(
      false,
    );
  });

  it('pending=true + elapsed >= MIN_THINKING_MS → show', () => {
    expect(
      shouldShowThinkingDot({
        pending: true,
        elapsedMs: MIN_THINKING_MS,
        composerHasText: false,
      }),
    ).toBe(true);
  });

  it('pending=true + elapsed < MIN_THINKING_MS → hide (no flash)', () => {
    expect(shouldShowThinkingDot({ pending: true, elapsedMs: 100, composerHasText: false })).toBe(
      false,
    );
  });

  it('composerHasText=true hides the dot even when pending', () => {
    expect(
      shouldShowThinkingDot({
        pending: true,
        elapsedMs: 9999,
        composerHasText: true,
      }),
    ).toBe(false);
  });

  it('MIN_THINKING_MS is the canonical 220ms', () => {
    expect(MIN_THINKING_MS).toBe(220);
  });

  it('boundary at exactly MIN_THINKING_MS-1 (just before show)', () => {
    expect(
      shouldShowThinkingDot({
        pending: true,
        elapsedMs: MIN_THINKING_MS - 1,
        composerHasText: false,
      }),
    ).toBe(false);
  });
});
