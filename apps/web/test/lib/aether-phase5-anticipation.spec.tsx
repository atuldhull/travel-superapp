/**
 * Vitest specs for AE597 — the Phase 5 predictor→surface-manager wiring
 * (`useSurfaceAnticipation`).
 *
 * Pure `pushRecentSurface` + `anticipationTarget` (no React), then jsdom
 * hook tests that the hook feeds the manager's `anticipate()` socket,
 * accumulates recency history across navigation, and respects the
 * `enabled` gate.
 */
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SurfaceManagerProvider, createSurfaceRegistry, useSurfaceManager } from '@app/aether-core';
import type { PredictableSurfaceId, SurfacePredictor } from '@app/aether-canvas-shared';
import {
  DEFAULT_ANTICIPATION_HISTORY_LIMIT,
  anticipationTarget,
  pushRecentSurface,
  useSurfaceAnticipation,
  type UseSurfaceAnticipationOptions,
} from '../../src/components/aether/phase5/use-surface-anticipation';

describe('pushRecentSurface', () => {
  it('appends newest-last', () => {
    expect(pushRecentSurface(['drift'], 'atlas')).toEqual(['drift', 'atlas']);
  });
  it('returns the SAME reference on a consecutive duplicate (no re-render)', () => {
    const h: readonly PredictableSurfaceId[] = ['drift', 'atlas'];
    expect(pushRecentSurface(h, 'atlas')).toBe(h);
  });
  it('caps to the limit, dropping the oldest', () => {
    expect(pushRecentSurface(['drift', 'atlas', 'compass'], 'vault', 2)).toEqual([
      'compass',
      'vault',
    ]);
  });
  it('floors a < 1 or non-finite limit', () => {
    expect(pushRecentSurface(['drift', 'atlas'], 'vault', 0)).toEqual(['vault']);
    expect(pushRecentSurface([], 'vault', Number.NaN).length).toBe(1);
  });
});

describe('anticipationTarget', () => {
  it('returns the confident top pick (real heuristic, morning/planning from drift)', () => {
    const target = anticipationTarget({
      currentSurface: 'drift',
      recentSurfaces: ['drift'],
      dwellMsOnCurrent: 0,
      timeOfDay: 'morning',
      tripPhase: 'planning',
      dayOfTripIndex: null,
    });
    expect(target).toBe('atlas');
  });
  it('returns null when the predictor yields no signal', () => {
    const empty: SurfacePredictor = { predict: () => [] };
    const target = anticipationTarget(
      {
        currentSurface: null,
        recentSurfaces: [],
        dwellMsOnCurrent: 0,
        timeOfDay: 'morning',
        tripPhase: 'planning',
        dayOfTripIndex: null,
      },
      empty,
    );
    expect(target).toBeNull();
  });
});

/** A registry with two literal-routed surfaces so `current` resolves as
 *  we navigate. */
function makeWrap(initialPathname: string): React.FC<{ children: React.ReactNode }> {
  const registry = createSurfaceRegistry([
    { id: 'drift', phase: 1, route: { kind: 'literal', pathname: '/aether/drift' } },
    { id: 'atlas', phase: 1, route: { kind: 'literal', pathname: '/aether/atlas' } },
  ]);
  return function Wrap({ children }) {
    return (
      <SurfaceManagerProvider registry={registry} initialPathname={initialPathname}>
        {children}
      </SurfaceManagerProvider>
    );
  };
}

/** Deterministic stub predictor: maps the current surface to a fixed next. */
const NEXT: Partial<Record<PredictableSurfaceId, PredictableSurfaceId>> = {
  drift: 'compass',
  atlas: 'vault',
};
const stubPredictor: SurfacePredictor = {
  predict: (f) =>
    f.currentSurface ? [{ surface: NEXT[f.currentSurface] ?? 'echo', score: 1 }] : [],
};

describe('useSurfaceAnticipation — integration', () => {
  function run(initialProps: UseSurfaceAnticipationOptions, pathname = '/aether/drift') {
    return renderHook(
      (props: UseSurfaceAnticipationOptions) => ({
        target: useSurfaceAnticipation(props),
        manager: useSurfaceManager(),
      }),
      { wrapper: makeWrap(pathname), initialProps },
    );
  }

  it('feeds the predicted surface into anticipate() and returns it', () => {
    const { result } = run({ enabled: true, predictor: stubPredictor });
    expect(result.current.target).toBe('compass');
    expect(result.current.manager.anticipating).toBe('compass');
  });

  it('re-runs across navigation as the current surface changes', () => {
    const { result } = run({ enabled: true, predictor: stubPredictor });
    expect(result.current.manager.anticipating).toBe('compass'); // on drift
    act(() => {
      result.current.manager.setRoute('/aether/atlas');
    });
    expect(result.current.manager.anticipating).toBe('vault'); // atlas -> vault
  });

  it('does not anticipate when disabled (anticipating stays null)', () => {
    const { result } = run({ enabled: false, predictor: stubPredictor });
    expect(result.current.target).toBeNull();
    expect(result.current.manager.anticipating).toBeNull();
  });

  it('clears the pre-warm when toggled off', () => {
    const { result, rerender } = run({ enabled: true, predictor: stubPredictor });
    expect(result.current.manager.anticipating).toBe('compass');
    act(() => {
      rerender({ enabled: false, predictor: stubPredictor });
    });
    expect(result.current.manager.anticipating).toBeNull();
  });

  it('drives anticipation from the real heuristic + an injected clock', () => {
    const { result } = run({ enabled: true, localHour: () => 9, tripPhase: 'planning' });
    // drift + morning + planning -> atlas is the confident pick.
    expect(result.current.manager.anticipating).toBe('atlas');
  });

  it('exposes the default history limit', () => {
    expect(DEFAULT_ANTICIPATION_HISTORY_LIMIT).toBe(8);
  });

  it('the injected clock actually drives the time-of-day bucket (afternoon -> null)', () => {
    // Same state as the morning case but hour 14 = afternoon: atlas drops
    // to ~0.325 (< the 0.34 floor) so the gate clears anticipate() to null.
    // Pairing morning->atlas with afternoon->null proves the bucket is
    // computed from the clock, not a frozen literal.
    const { result } = run({ enabled: true, localHour: () => 14, tripPhase: 'planning' });
    expect(result.current.manager.anticipating).toBeNull();
  });

  it('tripPhase is a live input to the prediction (planning -> post-trip flips to null)', () => {
    const { result, rerender } = run({
      enabled: true,
      localHour: () => 9,
      tripPhase: 'planning',
    });
    expect(result.current.manager.anticipating).toBe('atlas');
    act(() => {
      rerender({ enabled: true, localHour: () => 9, tripPhase: 'post-trip' });
    });
    // post-trip/morning from drift: atlas falls to ~0.305 (< floor) -> null.
    expect(result.current.manager.anticipating).toBeNull();
  });

  it('accumulates recency history across navigation and caps it (historyLimit)', () => {
    // A stub that reports the history length so we can observe the buffer
    // growing + staying capped through the hook's effect.
    const byLen = (n: number): PredictableSurfaceId =>
      n <= 1 ? 'atlas' : n === 2 ? 'compass' : 'vault';
    const historyLenPredictor: SurfacePredictor = {
      predict: (f) => [{ surface: byLen(f.recentSurfaces.length), score: 1 }],
    };
    const { result } = run({ enabled: true, predictor: historyLenPredictor, historyLimit: 2 });
    expect(result.current.manager.anticipating).toBe('atlas'); // history ['drift'] (len 1)
    act(() => {
      result.current.manager.setRoute('/aether/atlas');
    });
    expect(result.current.manager.anticipating).toBe('compass'); // ['drift','atlas'] (len 2)
    act(() => {
      result.current.manager.setRoute('/aether/drift');
    });
    // ['drift','atlas','drift'] capped to 2 -> still len 2 (compass), NOT
    // vault — proving historyLimit is threaded into the hook's buffer.
    expect(result.current.manager.anticipating).toBe('compass');
  });
});
