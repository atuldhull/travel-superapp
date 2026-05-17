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
        'inline-flex items-center gap-0.5 rounded-full border border-gold-600/20 bg-surface/60 p-0.5 text-xs backdrop-blur-sm',
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
              'rounded-full px-2.5 py-1 font-medium transition',
              selected
                ? 'text-brand-900 shadow-(--shadow-depth-1)'
                : 'text-muted hover:bg-gold-500/10 hover:text-surface-foreground',
            )}
            style={selected ? { backgroundImage: 'var(--gradient-gold)' } : undefined}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
