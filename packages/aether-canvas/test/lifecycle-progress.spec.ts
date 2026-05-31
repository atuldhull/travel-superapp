/** AE375 — lifecycle-progress pure-math specs. */
import {
  DEFAULT_PHASE_DURATIONS,
  __testing,
  easeInCubic,
  easeOutCubic,
  easedPhaseProgress,
  isPhaseComplete,
  phaseProgress,
} from '../src/lifecycle-progress';

describe('DEFAULT_PHASE_DURATIONS', () => {
  it('sums transient phases to ~1.7s (a beat-and-a-half)', () => {
    const sum =
      DEFAULT_PHASE_DURATIONS.materialising +
      DEFAULT_PHASE_DURATIONS.settling +
      DEFAULT_PHASE_DURATIONS.dissolving;
    expect(sum).toBeCloseTo(1.7, 3);
  });
});

describe('clamp01', () => {
  const { clamp01 } = __testing;
  it('passes values in range', () => {
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(1)).toBe(1);
  });

  it('clamps below 0', () => {
    expect(clamp01(-0.1)).toBe(0);
    expect(clamp01(-100)).toBe(0);
  });

  it('clamps above 1', () => {
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(99)).toBe(1);
  });
});

describe('wrap01', () => {
  const { wrap01 } = __testing;
  it('wraps modulo period', () => {
    expect(wrap01(0, 1)).toBe(0);
    expect(wrap01(0.5, 1)).toBe(0.5);
    expect(wrap01(1.0, 1)).toBe(0);
    expect(wrap01(1.6, 1)).toBeCloseTo(0.6, 6);
    expect(wrap01(3.25, 1)).toBeCloseTo(0.25, 6);
  });

  it('handles non-unit periods', () => {
    expect(wrap01(0.5, 2)).toBe(0.25);
    expect(wrap01(3.0, 2)).toBe(0.5);
  });

  it('returns 0 when period is non-positive', () => {
    expect(wrap01(1, 0)).toBe(0);
    expect(wrap01(1, -1)).toBe(0);
  });
});

describe('easeOutCubic', () => {
  it('boundary values', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it('decelerates: mid-value > linear (.5)', () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });

  it('clamps inputs outside [0, 1]', () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
  });
});

describe('easeInCubic', () => {
  it('boundary values', () => {
    expect(easeInCubic(0)).toBe(0);
    expect(easeInCubic(1)).toBe(1);
  });

  it('accelerates: mid-value < linear (.5)', () => {
    expect(easeInCubic(0.5)).toBeLessThan(0.5);
  });

  it('clamps inputs outside [0, 1]', () => {
    expect(easeInCubic(-2)).toBe(0);
    expect(easeInCubic(5)).toBe(1);
  });
});

describe('phaseProgress — transient phases clamp', () => {
  it('materialising', () => {
    const d = DEFAULT_PHASE_DURATIONS.materialising;
    expect(phaseProgress('materialising', 0)).toBe(0);
    expect(phaseProgress('materialising', d / 2)).toBeCloseTo(0.5, 6);
    expect(phaseProgress('materialising', d)).toBe(1);
    expect(phaseProgress('materialising', d + 1)).toBe(1);
  });

  it('settling', () => {
    const d = DEFAULT_PHASE_DURATIONS.settling;
    expect(phaseProgress('settling', 0)).toBe(0);
    expect(phaseProgress('settling', d)).toBe(1);
    expect(phaseProgress('settling', d * 2)).toBe(1);
  });

  it('dissolving', () => {
    const d = DEFAULT_PHASE_DURATIONS.dissolving;
    expect(phaseProgress('dissolving', 0)).toBe(0);
    expect(phaseProgress('dissolving', d)).toBe(1);
  });

  it('negative elapsed is treated as zero', () => {
    expect(phaseProgress('materialising', -1)).toBe(0);
  });
});

describe('phaseProgress — ambient phases wrap', () => {
  it('idle wraps at the ambient period', () => {
    expect(phaseProgress('idle', 0)).toBe(0);
    expect(phaseProgress('idle', 0.5)).toBe(0.5);
    expect(phaseProgress('idle', 1.0)).toBe(0);
    expect(phaseProgress('idle', 1.6)).toBeCloseTo(0.6, 6);
  });

  it('listening wraps at the ambient period', () => {
    expect(phaseProgress('listening', 0)).toBe(0);
    expect(phaseProgress('listening', 2.5)).toBe(0.5);
  });
});

describe('easedPhaseProgress', () => {
  it('materialising uses ease-out', () => {
    const d = DEFAULT_PHASE_DURATIONS.materialising;
    const mid = easedPhaseProgress('materialising', d / 2);
    expect(mid).toBeGreaterThan(0.5);
  });

  it('dissolving uses ease-in', () => {
    const d = DEFAULT_PHASE_DURATIONS.dissolving;
    const mid = easedPhaseProgress('dissolving', d / 2);
    expect(mid).toBeLessThan(0.5);
  });

  it('ambient phases are linear', () => {
    expect(easedPhaseProgress('idle', 0.25)).toBe(0.25);
    expect(easedPhaseProgress('listening', 0.75)).toBe(0.75);
  });
});

describe('isPhaseComplete', () => {
  it('false until elapsed >= duration for transient phases', () => {
    expect(isPhaseComplete('materialising', 0)).toBe(false);
    expect(isPhaseComplete('materialising', DEFAULT_PHASE_DURATIONS.materialising - 0.01)).toBe(
      false,
    );
    expect(isPhaseComplete('materialising', DEFAULT_PHASE_DURATIONS.materialising)).toBe(true);
    expect(isPhaseComplete('settling', DEFAULT_PHASE_DURATIONS.settling)).toBe(true);
    expect(isPhaseComplete('dissolving', DEFAULT_PHASE_DURATIONS.dissolving)).toBe(true);
  });

  it('ambient phases are never complete', () => {
    expect(isPhaseComplete('idle', 1000)).toBe(false);
    expect(isPhaseComplete('listening', 1000)).toBe(false);
  });
});
