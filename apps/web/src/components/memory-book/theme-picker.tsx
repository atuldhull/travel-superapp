/**
 * V.UX.12 — theme picker for the memory-book editor. v1 ships
 * five hand-tuned themes; each one is a pair of CSS variables
 * (`--mb-accent` for chrome, `--mb-bg` for the page wash) that
 * the public viewer reads to repaint instantly.
 *
 * Each tile is a button — selection fires `onChange` with the
 * theme slug. The currently-selected tile gets a thick brand
 * border so the choice is unambiguous. Picker stays controlled
 * (parent owns the value) so theme is in sync with the live
 * preview pane.
 *
 * Installed by prompt [V.UX.12].
 */
'use client';

export interface MemoryBookTheme {
  readonly slug: string;
  readonly label: string;
  /** Inline CSS used to paint the preview swatch. */
  readonly accent: string;
  readonly bg: string;
}

export const MEMORY_BOOK_THEMES: readonly MemoryBookTheme[] = [
  { slug: 'classic', label: 'Classic', accent: '#374151', bg: '#f9fafb' },
  { slug: 'vintage', label: 'Vintage', accent: '#92400e', bg: '#fef3c7' },
  { slug: 'minimal', label: 'Minimal', accent: '#0f172a', bg: '#ffffff' },
  { slug: 'sunset', label: 'Sunset', accent: '#be185d', bg: '#fef2f2' },
  { slug: 'forest', label: 'Forest', accent: '#166534', bg: '#ecfdf5' },
];

export function getThemeBySlug(slug: string): MemoryBookTheme {
  return MEMORY_BOOK_THEMES.find((t) => t.slug === slug) ?? MEMORY_BOOK_THEMES[0]!;
}

export interface ThemePickerProps {
  readonly value: string;
  readonly onChange: (slug: string) => void;
  readonly disabled?: boolean;
}

export function ThemePicker({ value, onChange, disabled }: ThemePickerProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {MEMORY_BOOK_THEMES.map((t) => {
        const selected = t.slug === value;
        return (
          <button
            key={t.slug}
            type="button"
            disabled={disabled}
            onClick={() => onChange(t.slug)}
            aria-pressed={selected}
            aria-label={`${t.label} theme`}
            className={[
              'flex flex-col items-center gap-1 rounded-md border-2 p-2 text-xs transition disabled:opacity-50',
              selected ? 'border-brand bg-brand/5' : 'border-muted/15 hover:border-muted/30',
            ].join(' ')}
          >
            <span
              className="h-10 w-full rounded-sm"
              style={{
                background: `linear-gradient(135deg, ${t.accent} 0%, ${t.bg} 100%)`,
              }}
              aria-hidden="true"
            />
            <span className={selected ? 'font-semibold text-brand' : ''}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
