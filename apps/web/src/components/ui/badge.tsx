/**
 * Badge — small inline chip for status, tags, counts.
 *
 * Variants:
 *   - `neutral` (default) — muted bg, suits "draft", "pending"
 *   - `brand`             — brand-coloured, suits "published", "live"
 *   - `danger`            — danger tint, suits "archived", "failed"
 *
 * Installed by prompt [IV.18.19.27].
 */
import { type ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Variant = 'neutral' | 'brand' | 'danger';

const variantStyles: Record<Variant, string> = {
  neutral: 'bg-muted/10 text-muted',
  brand: 'bg-brand/10 text-brand',
  danger: 'bg-danger/10 text-danger',
};

export function Badge({
  variant = 'neutral',
  className,
  children,
}: {
  readonly variant?: Variant;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
