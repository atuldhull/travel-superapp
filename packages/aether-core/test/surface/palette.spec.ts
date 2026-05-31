/** AE381 — palette derivation specs. */
import {
  DEFAULT_SURFACE_PALETTE,
  __testing,
  blendHex,
  blendPalettes,
  isValidPalette,
  paletteForSurface,
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
