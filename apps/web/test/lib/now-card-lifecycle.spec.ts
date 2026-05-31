/** Vitest specs for AE386 — Now Card lifecycle styling helpers. */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NOW_CARD_DURATIONS,
  nowCardCssForPhase,
  nowCardOpacityForPhase,
  nowCardScaleForPhase,
  nowCardTransitionMs,
} from '../../src/components/aether/phase1/now-card-lifecycle';

describe('nowCardOpacityForPhase', () => {
  it('idle is invisible', () => {
    expect(nowCardOpacityForPhase('idle')).toBe(0);
  });

  it('materialising / settling / listening are visible', () => {
    expect(nowCardOpacityForPhase('materialising')).toBe(1);
    expect(nowCardOpacityForPhase('settling')).toBe(1);
    expect(nowCardOpacityForPhase('listening')).toBe(1);
  });

  it('dissolving is invisible (target = 0; CSS transition handles the fade)', () => {
    expect(nowCardOpacityForPhase('dissolving')).toBe(0);
  });
});

describe('nowCardScaleForPhase', () => {
  it('idle + dissolving sit at 0.96', () => {
    expect(nowCardScaleForPhase('idle')).toBe(0.96);
    expect(nowCardScaleForPhase('dissolving')).toBe(0.96);
  });

  it('materialising/settling/listening at 1.0', () => {
    expect(nowCardScaleForPhase('materialising')).toBe(1);
    expect(nowCardScaleForPhase('settling')).toBe(1);
    expect(nowCardScaleForPhase('listening')).toBe(1);
  });
});

describe('nowCardTransitionMs', () => {
  it('idle is 0ms (snap-back)', () => {
    expect(nowCardTransitionMs('idle')).toBe(0);
  });

  it('materialising uses materialisingMs', () => {
    expect(nowCardTransitionMs('materialising')).toBe(DEFAULT_NOW_CARD_DURATIONS.materialisingMs);
  });

  it('settling + listening use settlingMs', () => {
    expect(nowCardTransitionMs('settling')).toBe(DEFAULT_NOW_CARD_DURATIONS.settlingMs);
    expect(nowCardTransitionMs('listening')).toBe(DEFAULT_NOW_CARD_DURATIONS.settlingMs);
  });

  it('dissolving uses dissolvingMs', () => {
    expect(nowCardTransitionMs('dissolving')).toBe(DEFAULT_NOW_CARD_DURATIONS.dissolvingMs);
  });

  it('honours a custom durations object', () => {
    const durations = { materialisingMs: 1200, settlingMs: 800, dissolvingMs: 200 };
    expect(nowCardTransitionMs('materialising', durations)).toBe(1200);
    expect(nowCardTransitionMs('settling', durations)).toBe(800);
    expect(nowCardTransitionMs('dissolving', durations)).toBe(200);
  });
});

describe('nowCardCssForPhase', () => {
  it('idle: opacity 0, scale 0.96, instant transition', () => {
    const css = nowCardCssForPhase('idle');
    expect(css.opacity).toBe(0);
    expect(css.transform).toContain('scale(0.960)');
    expect(css.transition).toContain('0ms');
  });

  it('listening: opacity 1, scale 1.0', () => {
    const css = nowCardCssForPhase('listening');
    expect(css.opacity).toBe(1);
    expect(css.transform).toContain('scale(1.000)');
  });

  it('materialising: opacity 1 + ease-out cubic + materialisingMs', () => {
    const css = nowCardCssForPhase('materialising');
    expect(css.opacity).toBe(1);
    expect(css.transition).toContain('700ms');
    // Ease-out cubic shape (no leading 0., dotless cubic).
    expect(css.transition).toContain('cubic-bezier(0.16, 1, 0.3, 1)');
  });

  it('dissolving: opacity 0 + ease-in cubic + dissolvingMs', () => {
    const css = nowCardCssForPhase('dissolving');
    expect(css.opacity).toBe(0);
    expect(css.transition).toContain('500ms');
    // Ease-in cubic (different bezier from materialising).
    expect(css.transition).toContain('cubic-bezier(0.55, 0, 1, 0.45)');
  });

  it('transform always preserves the translate(-50%, -160%) anchor', () => {
    for (const p of ['idle', 'materialising', 'settling', 'listening', 'dissolving'] as const) {
      expect(nowCardCssForPhase(p).transform).toContain('translate(-50%, -160%)');
    }
  });

  it('transition string includes BOTH opacity + transform', () => {
    const css = nowCardCssForPhase('materialising');
    expect(css.transition).toContain('opacity');
    expect(css.transition).toContain('transform');
  });
});
