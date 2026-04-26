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
