/**
 * Vitest specs for AE216 shouldShowSuggestions — the visibility
 * gate for the Pulse 'Try one of these' seed-prompt strip.
 */
import { describe, expect, it } from 'vitest';
import {
  SUGGESTIONS_RECENT_THRESHOLD,
  shouldShowSuggestions,
} from '../../src/components/aether/pulse/should-show-suggestions';

describe('shouldShowSuggestions', () => {
  it('shows for a cold user (0 recent)', () => {
    expect(shouldShowSuggestions({ recentCount: 0 })).toBe(true);
  });

  it('shows for 1 recent', () => {
    expect(shouldShowSuggestions({ recentCount: 1 })).toBe(true);
  });

  it('shows for 2 recent', () => {
    expect(shouldShowSuggestions({ recentCount: 2 })).toBe(true);
  });

  it('hides at the threshold (3 recent)', () => {
    expect(shouldShowSuggestions({ recentCount: 3 })).toBe(false);
  });

  it('hides above the threshold', () => {
    expect(shouldShowSuggestions({ recentCount: 4 })).toBe(false);
    expect(shouldShowSuggestions({ recentCount: 99 })).toBe(false);
  });

  it('SUGGESTIONS_RECENT_THRESHOLD is the canonical 3', () => {
    expect(SUGGESTIONS_RECENT_THRESHOLD).toBe(3);
  });

  it('defends against negative count (treat as cold, show)', () => {
    expect(shouldShowSuggestions({ recentCount: -1 })).toBe(true);
  });
});
