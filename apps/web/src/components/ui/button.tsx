/**
 * Button — themed primary/outline/ghost variants. Hand-rolled
 * shadcn-style primitive; we don't pull the shadcn CLI yet because
 * Tailwind 4's config story collides with shadcn's default theme
 * generator, and we only need a handful of components for v1.
 *
 * Variants:
 *   - `primary` (default): filled with the brand colour. Main CTAs.
 *   - `outline`           : brand border, transparent fill. Secondary.
 *   - `ghost`             : neutral, only-on-hover background. Tertiary.
 *
 * Sizes:
 *   - `md` (default): py-2 px-4 (form / dialog defaults)
 *   - `sm`          : py-1.5 px-3 (toolbars / inline)
 *
 * Forwards refs so consumers can put it inside `<Tooltip>`, focus
 * managers, etc. without losing the underlying button element.
 *
 * Installed by prompt [IV.18.19.23].
 */
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'outline' | 'ghost';
type Size = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: Variant;
  readonly size?: Size;
}

const base =
  'inline-flex items-center justify-center gap-1 rounded-md font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:pointer-events-none';

const variantStyles: Record<Variant, string> = {
  primary: 'bg-brand text-brand-foreground hover:opacity-90',
  outline: 'border border-brand/30 text-brand hover:bg-brand/5',
  ghost: 'border border-muted/30 text-muted hover:bg-muted/10',
};

const sizeStyles: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(base, variantStyles[variant], sizeStyles[size], className)}
      {...rest}
    />
  );
});
