/**
 * POST.2 — TravelSuperApp wordmark + mark.
 *
 * Two presentations:
 *   • <Logo />            — full wordmark (mark + "TravelSuperApp")
 *   • <Logo variant="mark"> — mark only (compact spaces, mobile header)
 *
 * Mark = stylised paper-plane / route arc inside a rounded square.
 * Wordmark uses Inter via the global font-sans variable.
 *
 * Pure SVG, no JS — server-renderable. currentColor on the mark
 * makes it inherit text color so the same logo works on light /
 * dark / coloured backgrounds.
 */
import Link from 'next/link';

export interface LogoProps {
  readonly variant?: 'wordmark' | 'mark';
  /** Optional className applied to the wrapper. */
  readonly className?: string;
  /** Hide the link wrapper and render as plain svg/div. */
  readonly asLink?: boolean;
  /** Tailwind size class for the mark, default `h-7 w-7`. */
  readonly markSize?: string;
}

function Mark({ size = 'h-7 w-7' }: { size?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={`${size} shrink-0`} role="img" aria-label="TravelSuperApp">
      {/* Rounded brand-blue square */}
      <rect x="0" y="0" width="32" height="32" rx="8" fill="currentColor" />
      {/* White route-arc + paper-plane shape */}
      <path
        d="M7 21 C 11 17, 17 13, 24 9"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M22 8 L 25 8 L 25 11 L 22 8 Z" fill="white" />
      <circle cx="7" cy="21" r="1.6" fill="white" />
    </svg>
  );
}

export function Logo({
  variant = 'wordmark',
  className,
  asLink = true,
  markSize = 'h-7 w-7',
}: LogoProps) {
  const inner =
    variant === 'mark' ? (
      <span className={`text-brand ${className ?? ''}`}>
        <Mark size={markSize} />
      </span>
    ) : (
      <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
        <span className="text-brand">
          <Mark size={markSize} />
        </span>
        <span className="text-base font-bold tracking-tight text-surface-foreground sm:text-lg">
          Travel<span className="text-brand">Super</span>App
        </span>
      </span>
    );
  if (!asLink) return inner;
  return (
    <Link
      href={'/' as never}
      aria-label="TravelSuperApp — home"
      className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      {inner}
    </Link>
  );
}
