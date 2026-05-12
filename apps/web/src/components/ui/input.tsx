/**
 * Input + Field — themed form primitives.
 *
 * `Input` wraps the native `<input>` and applies the standard border /
 * focus ring / disabled posture. `Field` is the labeled wrapper most
 * forms want — label above, input below, optional error / help text.
 *
 * Both forward refs so react-hook-form / native `useRef` keeps working.
 *
 * Installed by prompt [IV.18.19.23].
 */
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'block w-full rounded-md border border-muted/30 bg-surface px-3 py-2 text-sm text-surface-foreground transition',
        'focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand',
        'disabled:opacity-50 disabled:bg-muted/5',
        className,
      )}
      {...rest}
    />
  );
});

export interface FieldProps extends InputProps {
  readonly label: string;
  readonly help?: ReactNode;
  readonly error?: ReactNode;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, help, error, className, id, ...rest },
  ref,
) {
  // Stable autogen id so the <label> can target the input. Consumers
  // can still pass an explicit id to opt out.
  const inputId = id ?? `field-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <label htmlFor={inputId} className="block space-y-1">
      <span className="block text-sm font-medium">{label}</span>
      <Input ref={ref} id={inputId} className={className} {...rest} />
      {error ? (
        <span className="block text-xs text-danger">{error}</span>
      ) : help ? (
        <span className="block text-xs text-muted">{help}</span>
      ) : null}
    </label>
  );
});

/**
 * POST.2 — floating-label field. The label sits inside the input
 * border; on focus or when the input has a value, the label
 * shrinks + lifts above the top border into the gap.
 *
 * Pure CSS (`peer-placeholder-shown` + `peer-focus`) — no JS state
 * needed. Requires the input to have `placeholder=" "` so the
 * shrink-trigger fires correctly.
 */
export const FloatingField = forwardRef<HTMLInputElement, FieldProps>(function FloatingField(
  { label, help, error, className, id, ...rest },
  ref,
) {
  const inputId = id ?? `ffield-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="block space-y-1">
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          placeholder=" "
          className={cn(
            'peer block w-full rounded-md border border-muted/30 bg-surface px-3 pt-5 pb-2 text-sm text-surface-foreground transition',
            'focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand',
            'disabled:opacity-50 disabled:bg-muted/5',
            error && 'border-danger focus:border-danger focus:ring-danger',
            className,
          )}
          {...rest}
        />
        <label
          htmlFor={inputId}
          className={cn(
            'pointer-events-none absolute left-3 top-3.5 z-10 origin-left -translate-y-3 scale-75 transform bg-surface px-1 text-xs font-medium text-muted transition-all',
            'peer-placeholder-shown:top-3.5 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-placeholder-shown:text-sm',
            'peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:scale-75 peer-focus:px-1 peer-focus:text-brand',
            'top-0 -translate-y-1/2',
          )}
        >
          {label}
        </label>
      </div>
      {error ? (
        <span className="block text-xs text-danger">{error}</span>
      ) : help ? (
        <span className="block text-xs text-muted">{help}</span>
      ) : null}
    </div>
  );
});
