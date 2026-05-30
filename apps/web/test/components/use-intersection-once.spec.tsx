/**
 * Vitest jsdom specs for AE268 useIntersectionOnce.
 *
 * jsdom doesn't ship an IntersectionObserver — we stub it per-test.
 */
import { act, render } from '@testing-library/react';
import { useRef, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIntersectionOnce } from '../../src/components/aether/use-intersection-once';

interface FakeObserver {
  callback: IntersectionObserverCallback;
  observed: Set<Element>;
  disconnect: () => void;
  trigger: (intersecting: boolean) => void;
}

let lastObserver: FakeObserver | null = null;

function installFakeIO(): void {
  class FakeIO implements IntersectionObserver {
    root: Element | null = null;
    rootMargin = '';
    thresholds: ReadonlyArray<number> = [0];
    constructor(callback: IntersectionObserverCallback) {
      const obs: FakeObserver = {
        callback,
        observed: new Set<Element>(),
        disconnect: () => {
          obs.observed.clear();
        },
        trigger: (intersecting: boolean) => {
          const entries: IntersectionObserverEntry[] = [];
          for (const target of obs.observed) {
            entries.push({
              target,
              isIntersecting: intersecting,
              boundingClientRect: {} as DOMRectReadOnly,
              intersectionRatio: intersecting ? 1 : 0,
              intersectionRect: {} as DOMRectReadOnly,
              rootBounds: null,
              time: 0,
            } satisfies IntersectionObserverEntry);
          }
          callback(entries, this as unknown as IntersectionObserver);
        },
      };
      lastObserver = obs;
      this.observe = (el: Element): void => {
        obs.observed.add(el);
      };
      this.unobserve = (el: Element): void => {
        obs.observed.delete(el);
      };
      this.disconnect = obs.disconnect;
      this.takeRecords = (): IntersectionObserverEntry[] => [];
    }
    observe!: (el: Element) => void;
    unobserve!: (el: Element) => void;
    disconnect!: () => void;
    takeRecords!: () => IntersectionObserverEntry[];
  }
  (
    globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver }
  ).IntersectionObserver = FakeIO as unknown as typeof IntersectionObserver;
}

function uninstallFakeIO(): void {
  delete (globalThis as unknown as { IntersectionObserver?: typeof IntersectionObserver })
    .IntersectionObserver;
}

function Probe({ out, disabled }: { out: { visible: boolean }; disabled?: boolean }): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useIntersectionOnce<HTMLDivElement>(ref, { disabled });
  out.visible = visible;
  return <div ref={ref} data-testid="target" />;
}

describe('useIntersectionOnce', () => {
  beforeEach(() => {
    lastObserver = null;
    installFakeIO();
  });
  afterEach(() => {
    uninstallFakeIO();
  });

  it('returns false until intersection', () => {
    const out = { visible: true };
    render(<Probe out={out} />);
    expect(out.visible).toBe(false);
  });

  it('flips to true on first intersecting trigger', () => {
    const out = { visible: false };
    render(<Probe out={out} />);
    act(() => {
      lastObserver?.trigger(true);
    });
    expect(out.visible).toBe(true);
  });

  it('does NOT flip back to false on non-intersecting trigger', () => {
    const out = { visible: false };
    render(<Probe out={out} />);
    act(() => {
      lastObserver?.trigger(true);
    });
    expect(out.visible).toBe(true);
    act(() => {
      lastObserver?.trigger(false);
    });
    // Still true — one-shot.
    expect(out.visible).toBe(true);
  });

  it('disabled=true short-circuits to visible-immediately', () => {
    const out = { visible: false };
    render(<Probe out={out} disabled />);
    expect(out.visible).toBe(true);
  });
});
