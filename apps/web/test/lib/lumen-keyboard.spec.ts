/** Vitest specs for AE403 Lumen keyboard helpers. */
import { describe, expect, it } from 'vitest';
import {
  arrowDirectionFromKey,
  lumenFocusAnnouncement,
  nextPhotoInDirection,
} from '../../src/components/aether/phase2/lumen-keyboard';
import type { LumenPlaneLayout } from '../../src/components/aether/phase2/lumen-cloud';

function plane(id: string, position: [number, number, number]): LumenPlaneLayout {
  return { id, position, size: 1.6, url: null };
}

describe('arrowDirectionFromKey (pure)', () => {
  it('maps the 4 arrow keys', () => {
    expect(arrowDirectionFromKey('ArrowLeft')).toBe('left');
    expect(arrowDirectionFromKey('ArrowRight')).toBe('right');
    expect(arrowDirectionFromKey('ArrowUp')).toBe('up');
    expect(arrowDirectionFromKey('ArrowDown')).toBe('down');
  });
  it('returns null for unrelated keys', () => {
    expect(arrowDirectionFromKey('Tab')).toBeNull();
    expect(arrowDirectionFromKey('a')).toBeNull();
    expect(arrowDirectionFromKey('')).toBeNull();
  });
});

describe('nextPhotoInDirection — horizontal (time axis)', () => {
  const planes = [plane('mid', [0, 0, 0]), plane('left', [-5, 0, 0]), plane('right', [5, 0, 0])];

  it('null current + right → leftmost (seed)', () => {
    expect(nextPhotoInDirection(planes, null, 'right')).toBe('left');
  });
  it('right walks toward higher x', () => {
    expect(nextPhotoInDirection(planes, 'left', 'right')).toBe('mid');
    expect(nextPhotoInDirection(planes, 'mid', 'right')).toBe('right');
  });
  it('right past the end returns null', () => {
    expect(nextPhotoInDirection(planes, 'right', 'right')).toBeNull();
  });
  it('left walks toward lower x', () => {
    expect(nextPhotoInDirection(planes, 'right', 'left')).toBe('mid');
    expect(nextPhotoInDirection(planes, 'mid', 'left')).toBe('left');
  });
  it('left past the start returns null', () => {
    expect(nextPhotoInDirection(planes, 'left', 'left')).toBeNull();
  });
  it('empty planes → null', () => {
    expect(nextPhotoInDirection([], null, 'right')).toBeNull();
  });
  it('unknown current id → seeds to first', () => {
    expect(nextPhotoInDirection(planes, 'missing', 'right')).toBe('left');
  });
  it('tie-breaks horizontal by id', () => {
    const tied = [plane('b', [0, 0, 0]), plane('a', [0, 0, 0])];
    expect(nextPhotoInDirection(tied, null, 'right')).toBe('a');
  });
});

describe('nextPhotoInDirection — vertical (rating axis)', () => {
  const planes = [plane('mid', [0, 0, 0]), plane('top', [0, 4, 0]), plane('bottom', [0, -4, 0])];

  it('null current + up → topmost (seed)', () => {
    expect(nextPhotoInDirection(planes, null, 'up')).toBe('top');
  });
  it('down walks toward lower y', () => {
    expect(nextPhotoInDirection(planes, 'top', 'down')).toBe('mid');
    expect(nextPhotoInDirection(planes, 'mid', 'down')).toBe('bottom');
  });
  it('down past the end returns null', () => {
    expect(nextPhotoInDirection(planes, 'bottom', 'down')).toBeNull();
  });
  it('up walks toward higher y', () => {
    expect(nextPhotoInDirection(planes, 'bottom', 'up')).toBe('mid');
    expect(nextPhotoInDirection(planes, 'mid', 'up')).toBe('top');
  });
});

describe('lumenFocusAnnouncement (pure)', () => {
  const planes = [plane('first', [-5, 0, 0]), plane('mid', [0, 0, 0]), plane('last', [5, 0, 0])];

  it('null focus → "Cloud overview"', () => {
    expect(lumenFocusAnnouncement(null, planes)).toBe('Cloud overview');
  });
  it('focused → time-sorted index of N', () => {
    expect(lumenFocusAnnouncement('first', planes)).toBe('Photo 1 of 3');
    expect(lumenFocusAnnouncement('mid', planes)).toBe('Photo 2 of 3');
    expect(lumenFocusAnnouncement('last', planes)).toBe('Photo 3 of 3');
  });
  it('unknown focus id → overview', () => {
    expect(lumenFocusAnnouncement('missing', planes)).toBe('Cloud overview');
  });
  it('empty planes → overview', () => {
    expect(lumenFocusAnnouncement('whatever', [])).toBe('Cloud overview');
  });
});
