'use client';

/**
 * <Reveal> — wraps children in a one-shot fade + rise animation that
 * fires when the element first enters the viewport.
 *
 * Default: 14px rise + opacity 0→1, 700ms ease-out matching the
 * `book` spring's settle character. Set `delay` (ms) for staggered
 * reveals (cards in a grid). Set `motion='none'` on reduced-motion
 * surfaces to render visible immediately.
 */
import { type ReactNode } from 'react';
import { useMotionPolicy } from '@app/aether-core';
import { useInView } from '../use-in-view';

export interface RevealProps {
  children: ReactNode;
  /** Delay in ms before the rise begins after entering view. */
  readonly delay?: number;
  /** Vertical translate in px during the hidden state. Default 14. */
  readonly rise?: number;
  /** Tag to render. Default 'div'. */
  readonly as?: 'div' | 'section' | 'article' | 'li' | 'header' | 'footer';
  /** Pass-through className for layout. */
  readonly className?: string;
  /** Pass-through inline style for layout. */
  readonly style?: React.CSSProperties;
}

export function Reveal({
  children,
  delay = 0,
  rise = 14,
  as = 'div',
  className,
  style,
}: RevealProps): React.ReactElement {
  const motionPolicy = useMotionPolicy();
  const { ref, inView } = useInView<HTMLDivElement>();

  const animate = motionPolicy === 'full';
  const visible = !animate || inView;

  const Tag = as as 'div';
  const mergedStyle: React.CSSProperties = {
    ...style,
    opacity: visible ? 1 : 0,
    transform: visible ? 'translate3d(0, 0, 0)' : `translate3d(0, ${rise}px, 0)`,
    transition: animate
      ? `opacity 700ms cubic-bezier(0.16, 0.84, 0.32, 1) ${delay}ms, transform 700ms cubic-bezier(0.16, 0.84, 0.32, 1) ${delay}ms`
      : 'none',
    willChange: animate && !visible ? 'opacity, transform' : 'auto',
  };

  return (
    <Tag ref={ref} className={className} style={mergedStyle}>
      {children}
    </Tag>
  );
}
