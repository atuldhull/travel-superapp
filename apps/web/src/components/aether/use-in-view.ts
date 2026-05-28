'use client';

/**
 * useInView — fires once when the target element enters the viewport.
 *
 * Designed for Drift's reveal-on-scroll fade-ins. Once an element has
 * been seen, we stop observing it — the animation is one-shot and
 * we don't want the user re-triggering it as they scroll up.
 *
 * SSR-safe: returns `false` during SSR + on the first client render.
 * Hydration races resolve on the next observer callback.
 */
import { useEffect, useRef, useState, type RefObject } from 'react';

export interface UseInViewOptions {
  /** Viewport margin offset, e.g. '-10% 0px'. Default '-12% 0px' so reveals fire slightly before they enter. */
  readonly rootMargin?: string;
  /** Visibility threshold (0..1). Default 0.12 — 12% of element visible. */
  readonly threshold?: number;
}

export function useInView<T extends HTMLElement = HTMLDivElement>(
  options: UseInViewOptions = {},
): { ref: RefObject<T | null>; inView: boolean } {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState<boolean>(false);

  useEffect(() => {
    const node = ref.current;
    if (node === null) return;
    if (typeof IntersectionObserver === 'undefined') {
      // Old browsers — show everything immediately, no fade.
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
            break;
          }
        }
      },
      {
        rootMargin: options.rootMargin ?? '-12% 0px',
        threshold: options.threshold ?? 0.12,
      },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [options.rootMargin, options.threshold]);

  return { ref, inView };
}
