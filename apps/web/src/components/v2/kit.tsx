/**
 * v2 ("Fusion") landing — shared visual kit.
 *
 * Pure presentational primitives + helpers shared across every v2
 * section so the whole page reads as ONE coherent, magazine-grade
 * design. No client-only code here (no hooks / event handlers), so
 * this module is safe to import from both server and client sections.
 *
 * Design language (the "Fusion" brief):
 *   • A dark, cinematic HERO (always dark, theme-independent).
 *   • A light, airy EDITORIAL body on `bg-surface` (theme-aware).
 *   • Champagne-gold accents (`--color-gold-*`) + Playfair display
 *     serif headings + Inter UI text. Generous whitespace.
 *
 * Tokens come from globals.css (@theme): gold-300..700, brand-*,
 * --gradient-gold, --gradient-royal, --shadow-depth-*, --shadow-glow,
 * font-display (Playfair), the .glass utility.
 */
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../lib/cn';

/** Champagne-gold foil text — clip the gold gradient to the glyphs. */
export const GOLD_TEXT: CSSProperties = {
  backgroundImage: 'var(--gradient-gold)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
};

/** Gold uppercase eyebrow label that sits above a section title. */
export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <p
      className={cn(
        'text-xs font-semibold uppercase tracking-[0.22em] text-gold-600 dark:text-gold-400',
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Consistent editorial section container — the body's vertical rhythm. */
export function Section({
  id,
  children,
  className,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <section
      id={id}
      className={cn('mx-auto w-full max-w-7xl px-6 py-16 sm:py-20 lg:py-24', className)}
    >
      {children}
    </section>
  );
}

/**
 * Section heading row — eyebrow + Playfair title + optional dek and a
 * right-aligned "see all" action. `center` stacks + centres it.
 */
export function SectionHeading({
  eyebrow,
  title,
  dek,
  action,
  center = false,
}: {
  eyebrow?: string;
  title: ReactNode;
  dek?: string;
  action?: { href: string; label: string };
  center?: boolean;
}): React.ReactElement {
  return (
    <div
      className={cn(
        'mb-10 flex flex-col gap-4 sm:mb-12',
        center ? 'items-center text-center' : 'sm:flex-row sm:items-end sm:justify-between',
      )}
    >
      <div className={cn('space-y-3', center && 'max-w-2xl')}>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h2 className="font-display text-3xl font-semibold leading-[1.12] tracking-tight text-surface-foreground sm:text-4xl lg:text-[2.6rem]">
          {title}
        </h2>
        {dek ? <p className="max-w-xl text-base leading-relaxed text-muted">{dek}</p> : null}
      </div>
      {action ? (
        <Link
          href={action.href as never}
          className="group inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-gold-600 transition hover:text-gold-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:text-gold-400"
        >
          {action.label}
          <span aria-hidden className="transition group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      ) : null}
    </div>
  );
}

/** Five-star rating (gold). `value` 0..5; filled to the nearest star. */
export function StarRating({
  value,
  className,
}: {
  value: number;
  className?: string;
}): React.ReactElement {
  const filled = Math.round(value);
  return (
    <span
      className={cn('inline-flex items-center gap-0.5', className)}
      aria-label={`${value.toFixed(1)} out of 5 stars`}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          className={cn('h-3.5 w-3.5', i < filled ? 'text-gold-500' : 'text-muted/25')}
          fill="currentColor"
          aria-hidden
        >
          <path d="M10 1.6l2.47 5 5.53.8-4 3.9.94 5.5L10 14.2l-4.94 2.6.94-5.5-4-3.9 5.53-.8z" />
        </svg>
      ))}
    </span>
  );
}
