/**
 * Vitest specs for AE231 roleVisuals — Pulse chat role → visual
 * contract mapping.
 */
import { describe, expect, it } from 'vitest';
import { roleVisuals } from '../../src/components/aether/pulse/role-styles';

describe('roleVisuals', () => {
  it('user → right-aligned, accent token, weight 500', () => {
    expect(roleVisuals('user')).toEqual({
      align: 'right',
      accentKey: 'user-accent',
      weight: 500,
    });
  });

  it('assistant → left-aligned, whisper token, weight 400', () => {
    expect(roleVisuals('assistant')).toEqual({
      align: 'left',
      accentKey: 'assistant-whisper',
      weight: 400,
    });
  });

  it('returned objects are not the same reference between roles', () => {
    expect(roleVisuals('user')).not.toBe(roleVisuals('assistant'));
  });

  it('user and assistant accentKeys are distinct', () => {
    expect(roleVisuals('user').accentKey).not.toBe(roleVisuals('assistant').accentKey);
  });

  it('alignments are mirror opposites', () => {
    expect(roleVisuals('user').align).toBe('right');
    expect(roleVisuals('assistant').align).toBe('left');
  });
});
