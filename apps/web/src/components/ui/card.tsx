/**
 * POST.2 — Card primitive with explicit depth levels.
 *
 *   <Card>                       — flat (depth-0; old default)
 *   <Card depth="raised">        — depth-2 shadow + hover lift to depth-3
 *   <Card depth="floating">      — depth-3 shadow + hover lift further
 *   <Card interactive>           — adds the cursor-pointer + lift physics
 *
 * Composition unchanged (CardHeader / CardTitle / CardSubtitle /
 * CardBody all keep the same surface). Backwards compatible — no
 * existing call site needs to change because the default depth is
 * "flat" which renders as the V.UX-era card shape.
 */
import { type ElementType, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

type CardDepth = 'flat' | 'raised' | 'floating';

interface CardProps extends HTMLAttributes<HTMLElement> {
  readonly as?: ElementType;
  readonly depth?: CardDepth;
  /** Adds cursor-pointer + lift on hover. Default false. */
  readonly interactive?: boolean;
  readonly children?: ReactNode;
}

const depthBase =
  'rounded-2xl border border-gold-600/12 bg-surface p-5 transition duration-200 ease-out';
const depthStyles: Record<CardDepth, string> = {
  flat: 'shadow-(--shadow-depth-1) hover:shadow-(--shadow-depth-2) hover:border-gold-600/25',
  raised:
    'shadow-(--shadow-depth-2) hover:shadow-(--shadow-depth-3) hover:-translate-y-1 hover:border-gold-600/30',
  floating:
    'shadow-(--shadow-depth-3) hover:shadow-(--shadow-glow) hover:-translate-y-1.5 hover:border-gold-500/40',
};

export function Card({
  as: Tag = 'div',
  depth = 'flat',
  interactive = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <Tag
      className={cn(depthBase, depthStyles[depth], interactive && 'cursor-pointer', className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={cn('mb-2 space-y-0.5', className)}>{children}</div>;
}

export function CardTitle({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <h2 className={cn('font-display text-xl font-semibold tracking-tight', className)}>
      {children}
    </h2>
  );
}

export function CardSubtitle({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return <p className={cn('text-sm text-muted', className)}>{children}</p>;
}

export function CardBody({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={cn('text-sm text-muted', className)}>{children}</div>;
}
