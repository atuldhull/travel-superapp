/**
 * TravelSuperApp wordmark + mark — premium "royal" rebuild.
 *
 *   • <Logo />              — mark + couture wordmark
 *   • <Logo variant="mark"> — mark only (compact / mobile)
 *
 * Mark = a royal-indigo gradient tile with a champagne-gold route
 * arc + a gold focal node, ringed by a hairline gold stroke. The
 * wordmark is set in the Playfair display serif with a gold-foil
 * "Super". Self-contained SVG gradients (no currentColor) so it
 * reads luxe on light, dark, and coloured grounds.
 *
 * Pure SVG/markup — server-renderable. Public API unchanged.
 */
import Link from 'next/link';

export interface LogoProps {
  readonly variant?: 'wordmark' | 'mark';
  readonly className?: string;
  readonly asLink?: boolean;
  readonly markSize?: string;
}

function Mark({ size = 'h-8 w-8' }: { size?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={`${size} shrink-0`} role="img" aria-label="TravelSuperApp">
      <defs>
        <linearGradient id="tsa-royal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1d2850" />
          <stop offset="50%" stopColor="#2a3a73" />
          <stop offset="100%" stopColor="#3a2d57" />
        </linearGradient>
        <linearGradient id="tsa-gold" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#b3873b" />
          <stop offset="50%" stopColor="#e0c483" />
          <stop offset="100%" stopColor="#cdab63" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="31" height="31" rx="9" fill="url(#tsa-royal)" />
      <rect
        x="0.5"
        y="0.5"
        width="31"
        height="31"
        rx="9"
        fill="none"
        stroke="url(#tsa-gold)"
        strokeOpacity="0.55"
      />
      <path
        d="M7 21 C 11 17, 17 13, 24 9"
        stroke="url(#tsa-gold)"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M21.5 7.5 L 25 7.5 L 25 11 Z" fill="url(#tsa-gold)" />
      <circle cx="7" cy="21" r="1.8" fill="#e0c483" />
    </svg>
  );
}

export function Logo({
  variant = 'wordmark',
  className,
  asLink = true,
  markSize = 'h-8 w-8',
}: LogoProps) {
  const inner =
    variant === 'mark' ? (
      <span className={className}>
        <Mark size={markSize} />
      </span>
    ) : (
      <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
        <Mark size={markSize} />
        <span className="font-display text-lg font-semibold tracking-tight text-surface-foreground sm:text-xl">
          Travel
          <span
            style={{
              backgroundImage: 'var(--gradient-gold)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Super
          </span>
          App
        </span>
      </span>
    );
  if (!asLink) return inner;
  return (
    <Link
      href={'/' as never}
      aria-label="TravelSuperApp — home"
      className="rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-accent"
    >
      {inner}
    </Link>
  );
}
