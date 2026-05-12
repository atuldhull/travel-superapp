/**
 * POST.2 — themed button primitive.
 *
 * Variants:
 *   • primary   — filled brand, depth-2 shadow, hover lift + depth-3
 *   • secondary — brand-outlined; hover fills with brand/5
 *   • ghost     — neutral border, only-on-hover background
 *   • danger    — rose; same physics as primary (used for destructive ops)
 *
 * Sizes:
 *   • md (default) — text-sm + py-2 + px-4
 *   • sm           — text-xs + py-1.5 + px-3
 *   • lg           — text-base + py-2.5 + px-5
 *
 * Hover physics (POST.2): primary + danger lift -translate-y-0.5
 * + jump from depth-2 → depth-3 shadow + brand-700 background. Active
 * presses translate-y-0 with depth-1 (clicks feel real). Comfort
 * mode untouched — globals.css min-height: 44px still applies.
 *
 * `loading` adds a small spinner + disables clicks (used by web
 * forms that can't optimistically commit). Passing `loading` also
 * prevents the click handler from firing twice.
 *
 * Forwards refs so consumers can mount inside <Tooltip> or focus
 * managers without losing the underlying button element.
 */
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

/** Public variant names. `outline` is a backwards-compat alias for
 *  `secondary` so V.UX-era call sites don't break. */
type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: Variant;
  readonly size?: Size;
  readonly loading?: boolean;
}

const base =
  'inline-flex items-center justify-center gap-1.5 rounded-md font-semibold ' +
  'transition-[transform,box-shadow,background-color,color] duration-150 ' +
  'select-none whitespace-nowrap ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface ' +
  'disabled:opacity-50 disabled:pointer-events-none ' +
  'active:translate-y-0';

const SECONDARY =
  'border border-brand/40 text-brand bg-transparent ' +
  'hover:-translate-y-0.5 hover:bg-brand/5 hover:border-brand/70';

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-brand text-brand-foreground shadow-(--shadow-depth-2) ' +
    'hover:-translate-y-0.5 hover:shadow-(--shadow-depth-3) hover:bg-brand-700 ' +
    'active:shadow-(--shadow-depth-1)',
  secondary: SECONDARY,
  outline: SECONDARY, // alias for V.UX-era call sites
  ghost: 'border border-muted/15 text-surface-foreground bg-transparent ' + 'hover:bg-muted/10',
  danger:
    'bg-danger text-white shadow-(--shadow-depth-2) ' +
    'hover:-translate-y-0.5 hover:shadow-(--shadow-depth-3) hover:opacity-90 ' +
    'active:shadow-(--shadow-depth-1)',
};

const sizeStyles: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('h-4 w-4 animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path
        d="M12 2a10 10 0 0110 10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    className,
    type = 'button',
    loading = false,
    disabled,
    children,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      type={type}
      aria-busy={loading || undefined}
      disabled={isDisabled}
      className={cn(base, variantStyles[variant], sizeStyles[size], className)}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
});
