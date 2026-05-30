/**
 * AE268 — one-shot IntersectionObserver hook.
 *
 * Pattern: a section that should reveal once when it first scrolls
 * into view, then stop observing (so we don't fight the user when
 * they scroll back). Replaces hand-rolled observer code in the
 * `<Reveal/>` primitive's many sites that want a one-shot.
 *
 *   const ref = useRef<HTMLDivElement>(null);
 *   const visible = useIntersectionOnce(ref, { rootMargin: '0px' });
 *
 * SSR-safe: returns `false` until mount; the IO is constructed in
 * useEffect so it never runs server-side.
 */
import { useEffect, useState } from 'react';

export interface UseIntersectionOnceOptions {
  readonly rootMargin?: string;
  readonly threshold?: number;
  /** Skip the observer entirely (e.g. for reduced-motion users
   *  who get content shown immediately). */
  readonly disabled?: boolean;
}

export function useIntersectionOnce<T extends Element>(
  ref: React.RefObject<T | null>,
  options: UseIntersectionOnceOptions = {},
): boolean {
  const [seen, setSeen] = useState<boolean>(false);
  const { rootMargin, threshold, disabled } = options;
  useEffect(() => {
    if (disabled === true) {
      setSeen(true);
      return;
    }
    if (typeof window === 'undefined') return;
    if (typeof IntersectionObserver === 'undefined') {
      // Bail to visible-immediately on browsers without IO.
      setSeen(true);
      return;
    }
    const node = ref.current;
    if (node === null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting === true) {
            setSeen(true);
            observer.disconnect();
            break;
          }
        }
      },
      {
        rootMargin: rootMargin ?? '0px',
        threshold: threshold ?? 0,
      },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, rootMargin, threshold, disabled]);
  return seen;
}
