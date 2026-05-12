/**
 * POST.2 — themed Select primitive matching Input's posture.
 *
 *   <Select> wraps <select>; <SelectField> adds a label / help / error
 *   wrapper identical in shape to <Field>.
 *
 * Native select element under the hood — keyboard, accessibility,
 * and mobile picker UI come for free. Themed via custom chevron
 * background-image so the indicator works on every browser without
 * shipping an icon library.
 */
import { forwardRef, type SelectHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

const chevron =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2364748b'><path fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z' clip-rule='evenodd'/></svg>";

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        'block w-full appearance-none rounded-md border border-muted/30 bg-surface px-3 py-2 pr-9 text-sm text-surface-foreground transition',
        'focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand',
        'disabled:opacity-50 disabled:bg-muted/5',
        className,
      )}
      style={{
        backgroundImage: `url("${chevron}")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.5rem center',
        backgroundSize: '1.25em',
      }}
      {...rest}
    />
  );
});

export interface SelectFieldProps extends SelectProps {
  readonly label: string;
  readonly help?: ReactNode;
  readonly error?: ReactNode;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, help, error, className, id, children, ...rest },
  ref,
) {
  const selectId = id ?? `sfield-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <label htmlFor={selectId} className="block space-y-1">
      <span className="block text-sm font-medium">{label}</span>
      <Select ref={ref} id={selectId} className={className} {...rest}>
        {children}
      </Select>
      {error ? (
        <span className="block text-xs text-danger">{error}</span>
      ) : help ? (
        <span className="block text-xs text-muted">{help}</span>
      ) : null}
    </label>
  );
});
