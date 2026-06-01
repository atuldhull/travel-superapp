/** AE381 — palette derivation specs. */
import {
  DEFAULT_SURFACE_PALETTE,
  PALETTE_SLOT_NAMES,
  __testing,
  blendHex,
  blendPalettes,
  isValidPalette,
  paletteForSurface,
  paletteSlotIndex,
  paletteSlotName,
  slotsFor,
  type SurfacePalette,
} from '../../src/surface/palette';
import type { Surface } from '../../src/surface/types';

const CUSTOM: SurfacePalette = ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF'];

describe('DEFAULT_SURFACE_PALETTE', () => {
  it('has 5 hex colours', () => {
    expect(DEFAULT_SURFACE_PALETTE.length).toBe(5);
    for (const c of DEFAULT_SURFACE_PALETTE) {
      expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('anchors to the Warm Italian brand: surface[1] = cream', () => {
    expect(DEFAULT_SURFACE_PALETTE[1]).toBe('#F2E8D5');
  });
});

describe('isValidPalette', () => {
  it('true for a 5-string array', () => {
    expect(isValidPalette(CUSTOM)).toBe(true);
    expect(isValidPalette(DEFAULT_SURFACE_PALETTE)).toBe(true);
  });

  it('false for wrong length', () => {
    expect(isValidPalette(['#fff', '#000'])).toBe(false);
    expect(isValidPalette(['#fff', '#000', '#000', '#000', '#000', '#000'])).toBe(false);
  });

  it('false for non-arrays + non-strings', () => {
    expect(isValidPalette(null)).toBe(false);
    expect(isValidPalette(undefined)).toBe(false);
    expect(isValidPalette({})).toBe(false);
    expect(isValidPalette([1, 2, 3, 4, 5])).toBe(false);
  });

  it('false for empty strings in the array', () => {
    expect(isValidPalette(['', '#fff', '#fff', '#fff', '#fff'])).toBe(false);
  });

  it('permissive of any non-empty string (rgb/hsl all pass)', () => {
    expect(
      isValidPalette([
        'rgb(0,0,0)',
        'hsl(60, 50%, 50%)',
        '#aaa',
        'CornflowerBlue',
        'var(--accent)',
      ]),
    ).toBe(true);
  });
});

function surfaceWith(palette?: SurfacePalette | undefined): Surface {
  return {
    id: 'drift',
    phase: 1,
    route: { kind: 'literal', pathname: '/x' },
    ...(palette !== undefined ? { palette } : {}),
  };
}

describe('paletteForSurface', () => {
  it('null surface → default', () => {
    expect(paletteForSurface(null)).toBe(DEFAULT_SURFACE_PALETTE);
  });

  it('surface without palette slot → default', () => {
    expect(paletteForSurface(surfaceWith(undefined))).toBe(DEFAULT_SURFACE_PALETTE);
  });

  it('surface with valid palette → that palette', () => {
    expect(paletteForSurface(surfaceWith(CUSTOM))).toBe(CUSTOM);
  });

  it('surface with malformed palette → default fallback', () => {
    const bad = {
      id: 'drift' as const,
      phase: 1 as const,
      route: { kind: 'literal' as const, pathname: '/x' },
      palette: ['#fff'] as unknown as SurfacePalette,
    };
    expect(paletteForSurface(bad)).toBe(DEFAULT_SURFACE_PALETTE);
  });
});

describe('slotsFor', () => {
  it('maps positions to named slots', () => {
    const s = slotsFor(CUSTOM);
    expect(s.ink).toBe('#000000');
    expect(s.surface).toBe('#FFFFFF');
    expect(s.accent).toBe('#FF0000');
    expect(s.glow).toBe('#00FF00');
    expect(s.support).toBe('#0000FF');
  });

  it('works on the default palette', () => {
    const s = slotsFor(DEFAULT_SURFACE_PALETTE);
    expect(s.surface).toBe('#F2E8D5');
    expect(s.accent).toBe('#C2614A');
  });
});

describe('blendHex', () => {
  it('t=0 returns the first colour', () => {
    expect(blendHex('#000000', '#FFFFFF', 0)).toBe('#000000');
  });

  it('t=1 returns the second colour', () => {
    expect(blendHex('#000000', '#FFFFFF', 1)).toBe('#ffffff');
  });

  it('t=0.5 = midpoint', () => {
    expect(blendHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });

  it('clamps t to [0, 1] when over-range', () => {
    expect(blendHex('#000000', '#FFFFFF', -1)).toBe('#000000');
    expect(blendHex('#000000', '#FFFFFF', 2)).toBe('#ffffff');
  });

  it('non-hex input → snaps to nearer endpoint', () => {
    expect(blendHex('rgb(0,0,0)', '#ffffff', 0.2)).toBe('rgb(0,0,0)');
    expect(blendHex('rgb(0,0,0)', '#ffffff', 0.8)).toBe('#ffffff');
  });
});

describe('blendPalettes', () => {
  const A = DEFAULT_SURFACE_PALETTE;
  const B = CUSTOM;

  it('t=0 returns the first palette element-wise', () => {
    const out = blendPalettes(A, B, 0);
    // Normalised hex lowercase comparison.
    for (let i = 0; i < 5; i += 1) {
      expect(out[i]!.toLowerCase()).toBe(A[i]!.toLowerCase());
    }
  });

  it('t=1 returns the second palette element-wise', () => {
    const out = blendPalettes(A, B, 1);
    for (let i = 0; i < 5; i += 1) {
      expect(out[i]!.toLowerCase()).toBe(B[i]!.toLowerCase());
    }
  });

  it('t=0.5 blends each slot', () => {
    const out = blendPalettes(['#000000', '#000000', '#000000', '#000000', '#000000'], CUSTOM, 0.5);
    expect(out[2]).toBe('#800000'); // half of #FF0000
  });

  it('clamps t outside [0, 1]', () => {
    const at0 = blendPalettes(A, B, 0);
    const atNeg = blendPalettes(A, B, -5);
    expect(atNeg).toEqual(at0);
  });
});

describe('parseHex (internal)', () => {
  const { parseHex, toHex } = __testing;

  it('parses lowercase + uppercase', () => {
    expect(parseHex('#abcdef')).toEqual({ r: 0xab, g: 0xcd, b: 0xef });
    expect(parseHex('#ABCDEF')).toEqual({ r: 0xab, g: 0xcd, b: 0xef });
  });

  it('rejects malformed strings', () => {
    expect(parseHex('abc')).toBeNull();
    expect(parseHex('#abc')).toBeNull();
    expect(parseHex('#abcdefg')).toBeNull();
    expect(parseHex('rgb(0,0,0)')).toBeNull();
  });

  it('toHex pads + clamps to [0, 255]', () => {
    expect(toHex(0)).toBe('00');
    expect(toHex(15)).toBe('0f');
    expect(toHex(255)).toBe('ff');
    expect(toHex(300)).toBe('ff');
    expect(toHex(-1)).toBe('00');
  });
});

describe('PALETTE_SLOT_NAMES + paletteSlotName + paletteSlotIndex (AE441)', () => {
  it('PALETTE_SLOT_NAMES lists 5 slots in tuple order', () => {
    expect(PALETTE_SLOT_NAMES).toEqual(['ink', 'surface', 'accent', 'glow', 'support']);
    expect(PALETTE_SLOT_NAMES.length).toBe(DEFAULT_SURFACE_PALETTE.length);
  });
  it("PALETTE_SLOT_NAMES is frozen so consumers can't mutate it", () => {
    expect(Object.isFrozen(PALETTE_SLOT_NAMES)).toBe(true);
  });
  it('paletteSlotName maps each tuple index to its slot', () => {
    expect(paletteSlotName(0)).toBe('ink');
    expect(paletteSlotName(1)).toBe('surface');
    expect(paletteSlotName(2)).toBe('accent');
    expect(paletteSlotName(3)).toBe('glow');
    expect(paletteSlotName(4)).toBe('support');
  });
  it('paletteSlotName returns null for out-of-range / NaN', () => {
    expect(paletteSlotName(-1)).toBeNull();
    expect(paletteSlotName(5)).toBeNull();
    expect(paletteSlotName(Number.NaN)).toBeNull();
    expect(paletteSlotName(1.5)).toBeNull();
    expect(paletteSlotName(Number.POSITIVE_INFINITY)).toBeNull();
  });
  it('paletteSlotIndex maps slot names back to indices', () => {
    expect(paletteSlotIndex('ink')).toBe(0);
    expect(paletteSlotIndex('surface')).toBe(1);
    expect(paletteSlotIndex('support')).toBe(4);
  });
  it('paletteSlotIndex returns -1 for unknown names', () => {
    expect(paletteSlotIndex('unknown')).toBe(-1);
    expect(paletteSlotIndex('')).toBe(-1);
  });
  it('slot-name + slotsFor agree at every index', () => {
    const slots = slotsFor(DEFAULT_SURFACE_PALETTE);
    PALETTE_SLOT_NAMES.forEach((name, i) => {
      expect(slots[name]).toBe(DEFAULT_SURFACE_PALETTE[i]);
    });
  });
});

/** AE476 — boundary specs for paletteSlotIndex + paletteSlotName beyond
 *  the nominal cases AE441 already covers. */
describe('paletteSlotIndex edge cases (AE476)', () => {
  it('empty string returns -1', () => {
    expect(paletteSlotIndex('')).toBe(-1);
  });

  it('mixed-case names return -1 (lookup is case-sensitive)', () => {
    expect(paletteSlotIndex('Ink')).toBe(-1);
    expect(paletteSlotIndex('INK')).toBe(-1);
    expect(paletteSlotIndex('Surface')).toBe(-1);
    expect(paletteSlotIndex('SUPPORT')).toBe(-1);
  });

  it('names padded with whitespace return -1 (no trimming)', () => {
    expect(paletteSlotIndex('  ink  ')).toBe(-1);
    expect(paletteSlotIndex(' ink')).toBe(-1);
    expect(paletteSlotIndex('ink ')).toBe(-1);
  });

  it('partial substrings of a valid slot return -1', () => {
    expect(paletteSlotIndex('in')).toBe(-1);
    expect(paletteSlotIndex('surf')).toBe(-1);
    expect(paletteSlotIndex('supportx')).toBe(-1);
  });
});

describe('paletteSlotName edge cases (AE476)', () => {
  it('Number.NEGATIVE_INFINITY returns null', () => {
    expect(paletteSlotName(Number.NEGATIVE_INFINITY)).toBeNull();
  });

  it('non-integer 0.5 returns null', () => {
    expect(paletteSlotName(0.5)).toBeNull();
  });

  it('integer-valued floats (1.0) are accepted by Number.isInteger and map normally', () => {
    // Number.isInteger(1.0) === true — this is JS spec, not a bug.
    expect(paletteSlotName(1.0)).toBe('surface');
  });

  it('Number.MAX_SAFE_INTEGER returns null (out of range)', () => {
    expect(paletteSlotName(Number.MAX_SAFE_INTEGER)).toBeNull();
  });

  it('Number.MIN_SAFE_INTEGER returns null (out of range)', () => {
    expect(paletteSlotName(Number.MIN_SAFE_INTEGER)).toBeNull();
  });
});

describe('PALETTE_SLOT_NAMES length invariant (AE476)', () => {
  it('PALETTE_SLOT_NAMES length matches DEFAULT_SURFACE_PALETTE length', () => {
    expect(PALETTE_SLOT_NAMES.length).toBe(DEFAULT_SURFACE_PALETTE.length);
  });
});
