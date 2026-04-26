/**
 * Three-state theme toggle (Light / Dark / System). Renders as a
 * compact segmented control. Updates the theme store, which writes
 * `localStorage` + flips the `dark` class on `<html>`.
 *
 * Installed by prompt [IV.18.19.28].
 */
'use client';

import { setThemePreference, type ThemePreference } from '../../lib/theme-store';
import { useThemePreference } from '../../lib/use-theme';
import { cn } from '../../lib/cn';

const OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Auto' },
];

export function ThemeToggle({ className }: { className?: string }) {
  const current = useThemePreference();
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-muted/30 bg-surface p-0.5 text-xs',
        className,
      )}
    >
      {OPTIONS.map((opt) => {
        const selected = current === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setThemePreference(opt.value)}
            className={cn(
              'rounded px-2 py-1 font-medium transition',
              selected ? 'bg-brand text-brand-foreground' : 'text-muted hover:bg-muted/10',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
