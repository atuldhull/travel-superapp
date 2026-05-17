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

type Variant = 'neutral' | 'brand' | 'danger' | 'gold' | 'success';

const variantStyles: Record<Variant, string> = {
  neutral: 'bg-muted/10 text-muted ring-1 ring-inset ring-muted/20',
  brand: 'bg-brand/10 text-brand ring-1 ring-inset ring-brand/25',
  danger: 'bg-danger/10 text-danger ring-1 ring-inset ring-danger/25',
  gold: 'bg-gold-500/12 text-gold-700 ring-1 ring-inset ring-gold-500/35 dark:text-gold-300',
  success:
    'bg-emerald-500/12 text-emerald-700 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-300',
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
