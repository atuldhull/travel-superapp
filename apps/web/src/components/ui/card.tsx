/**
 * Card primitive — themed surface for list items + grouped content.
 *
 *   <Card>
 *     <CardHeader>
 *       <CardTitle>Title</CardTitle>
 *       <CardSubtitle>Sub</CardSubtitle>
 *     </CardHeader>
 *     <CardBody>...</CardBody>
 *   </Card>
 *
 * `Card` defaults to a `<div>` with hover-shadow; pass `as="li"` (or
 * any tag) when rendering inside a `<ul>` so the semantics line up.
 *
 * Installed by prompt [IV.18.19.27].
 */
import { type ElementType, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface CardProps extends HTMLAttributes<HTMLElement> {
  readonly as?: ElementType;
  readonly children?: ReactNode;
}

export function Card({ as: Tag = 'div', className, children, ...rest }: CardProps) {
  return (
    <Tag
      className={cn(
        'rounded-lg border border-muted/20 bg-surface p-4 shadow-sm transition hover:shadow',
        className,
      )}
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
  return <h2 className={cn('text-lg font-semibold tracking-tight', className)}>{children}</h2>;
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
