/**
 * @app/aether-motion — token shape + brand-lock tests.
 *
 * Treats the locked tokens as the ground truth for the brand. Changing
 * any expected value in this file requires an ADR (per
 * docs/aether/06-decisions.md). The tests fail loudly so a drive-by
 * "make terracotta a bit redder" PR can't ship without conscious sign-off.
 */
import { palette, semantic, COLOR_TOKEN_PATTERN, signal } from '../src/color';
import { book, springs, stagger, reducedMotion } from '../src/spring';
import { textStyle, fontSize, fontFamily } from '../src/type';
import { italianKey, samples, envelopes } from '../src/audio';
import { space, radius, layer } from '../src/scale';
import { theme } from '../src/index';

describe('Warm Italian palette is locked', () => {
  it('terracotta.base is the documented value', () => {
    expect(palette.terracotta.base).toBe('#C2614A');
  });

  it('every ramp value is a #RRGGBB hex or rgba(...)', () => {
    for (const ramp of Object.values(palette)) {
      for (const value of Object.values(ramp)) {
        expect(value).toMatch(COLOR_TOKEN_PATTERN);
      }
    }
  });

  it('semantic.accent maps to terracotta (the "do this" colour)', () => {
    expect(semantic.accent).toBe(palette.terracotta);
  });

  it('semantic.live maps to olive (the "active" colour)', () => {
    expect(semantic.live).toBe(palette.olive);
  });

  it('signal colours never overlap with ramp bases (signals interrupt)', () => {
    const rampBases = Object.values(palette).map((r) => r.base);
    for (const value of Object.values(signal)) {
      expect(rampBases).not.toContain(value);
    }
  });
});

describe('Spring physics — `book` is the brand', () => {
  it('book spring matches the locked Warm Italian feel', () => {
    expect(book).toEqual({
      stiffness: 120,
      damping: 18,
      mass: 1,
      restVelocity: 0.01,
      restDelta: 0.01,
    });
  });

  it('every spring has positive stiffness + damping (no inverted physics)', () => {
    for (const spring of Object.values(springs)) {
      expect(spring.stiffness).toBeGreaterThan(0);
      expect(spring.damping).toBeGreaterThan(0);
      expect(spring.mass).toBeGreaterThan(0);
    }
  });

  it('stagger hero > card > list (hero is the slowest)', () => {
    expect(stagger.hero).toBeGreaterThan(stagger.card);
    expect(stagger.card).toBeGreaterThan(stagger.list);
  });

  it('reduced-motion is sub-100ms with a linear curve', () => {
    expect(reducedMotion.durationMs).toBeLessThan(100);
    expect(reducedMotion.curve).toEqual([0, 0, 1, 1]);
  });
});

describe('Typography — two-family Warm Italian', () => {
  it('display family is serif-first', () => {
    expect(fontFamily.display).toMatch(/serif/);
    expect(fontFamily.display).toMatch(/GT Sectra/);
  });

  it('ui family is sans-first', () => {
    expect(fontFamily.ui).toMatch(/sans-serif/);
  });

  it('size scale is monotonically increasing', () => {
    const sizes = [
      fontSize.micro,
      fontSize.small,
      fontSize.body,
      fontSize.large,
      fontSize.subhead,
      fontSize.title,
      fontSize.hero,
      fontSize.display,
    ];
    for (let i = 1; i < sizes.length; i += 1) {
      expect(sizes[i]).toBeGreaterThan(sizes[i - 1]!);
    }
  });

  it('display text style uses the serif family + light weight', () => {
    expect(textStyle.display.family).toBe(fontFamily.display);
    expect(textStyle.display.weight).toBe(350);
  });

  it('body text style uses the sans family + 400 weight', () => {
    expect(textStyle.body.family).toBe(fontFamily.ui);
    expect(textStyle.body.weight).toBe(400);
  });
});

describe('Audio — Italian key signature', () => {
  it('Italian key is D minor pentatonic at 64bpm', () => {
    expect(italianKey.tonic).toBe('D3');
    expect(italianKey.tempo).toBe(64);
    expect(italianKey.scale).toContain('D3');
    expect(italianKey.scale).toContain('F3');
    expect(italianKey.scale).toContain('A3');
  });

  it('every sample manifest has a relative URL', () => {
    for (const sample of Object.values(samples)) {
      expect(sample.url).toMatch(/^\//);
    }
  });

  it('pluck envelope has short attack + long release (nylon string)', () => {
    expect(envelopes.pluck.attack).toBeLessThan(0.05);
    expect(envelopes.pluck.release).toBeGreaterThan(1);
  });
});

describe('Scale tokens', () => {
  it('space scale is monotonically increasing', () => {
    const ordered = [
      space.hairline,
      space.tight,
      space.inline,
      space.comfy,
      space.loose,
      space.gutter,
      space.margin,
      space.hero,
      space.surface,
    ];
    for (let i = 1; i < ordered.length; i += 1) {
      expect(ordered[i]).toBeGreaterThan(ordered[i - 1]!);
    }
  });

  it('radius pill is large enough to fully round any size', () => {
    expect(radius.pill).toBeGreaterThanOrEqual(9999);
  });

  it('z-index layers are monotonically increasing', () => {
    const layers = [
      layer.base,
      layer.raised,
      layer.sticky,
      layer.drawer,
      layer.modal,
      layer.overlay,
      layer.toast,
      layer.pulse,
    ];
    for (let i = 1; i < layers.length; i += 1) {
      expect(layers[i]).toBeGreaterThan(layers[i - 1]!);
    }
  });
});

describe('theme barrel', () => {
  it('exposes color + spring + text + audio + scale at the top level', () => {
    expect(theme.color.accent.base).toBe('#C2614A');
    expect(theme.spring.book.stiffness).toBe(120);
    expect(theme.text.body.family).toMatch(/sans-serif/);
    expect(theme.audio.keys.drift.tonic).toBe('D3');
    expect(theme.space.comfy).toBe(16);
  });
});
