/**
 * Landing hero. One-line value prop + dual CTA + animated illustration.
 *
 * The illustration is pure CSS / SVG (no JS animation library) so the
 * component stays a Server Component and the landing page keeps a 90+
 * Lighthouse mobile perf score.
 *
 * Installed by prompt [V.UX.1].
 */
import Link from 'next/link';

export function LandingHero() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-muted/15 bg-linear-to-br from-brand/10 via-transparent to-brand/5 px-6 py-12 sm:px-10 sm:py-16">
      <div className="relative z-10 grid gap-8 sm:grid-cols-2 sm:items-center">
        <div className="space-y-5">
          <p className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
            <span aria-hidden>✦</span> AI-powered travel companion
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Plan, explore, stay safe — <span className="text-brand">anywhere you go.</span>
          </h1>
          <p className="text-base leading-relaxed text-muted sm:text-lg">
            Type a city. Get a full itinerary in seconds. Live safety, weather, and crowd data built
            in. No spreadsheets. No 40 tabs.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <a
              href="#sample-trip"
              className="inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm transition hover:opacity-90"
            >
              See a sample trip <span aria-hidden>↓</span>
            </a>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-md border border-brand/40 px-5 py-2.5 text-sm font-semibold text-brand transition hover:bg-brand/5"
            >
              Sign up free
            </Link>
          </div>
          <p className="text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Open-source
            </span>
            <span className="mx-3 text-muted/40">·</span>
            <span>GDPR / DPDP compliant</span>
            <span className="mx-3 text-muted/40">·</span>
            <span>No card to try</span>
          </p>
        </div>
        <HeroIllustration />
      </div>
    </section>
  );
}

/**
 * Pure-CSS skyline → itinerary-card morph. Two stacked layers with
 * a CSS keyframe cross-fade. Respects `prefers-reduced-motion` via
 * the global Tailwind reduced-motion variant (no animation when set).
 */
function HeroIllustration() {
  return (
    <div className="relative mx-auto flex aspect-4/3 w-full max-w-md items-center justify-center">
      {/* Skyline layer */}
      <svg
        viewBox="0 0 320 240"
        className="absolute inset-0 h-full w-full motion-safe:animate-pulse motion-safe:[animation-duration:6s]"
        aria-hidden
      >
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.7 0.15 250)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="oklch(0.85 0.1 80)" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="320" height="240" fill="url(#sky)" rx="16" />
        {/* Buildings */}
        <rect x="30" y="120" width="40" height="100" fill="currentColor" opacity="0.55" rx="2" />
        <rect x="80" y="80" width="30" height="140" fill="currentColor" opacity="0.45" rx="2" />
        <rect x="120" y="100" width="35" height="120" fill="currentColor" opacity="0.65" rx="2" />
        <rect x="165" y="60" width="40" height="160" fill="currentColor" opacity="0.5" rx="2" />
        <rect x="215" y="110" width="30" height="110" fill="currentColor" opacity="0.55" rx="2" />
        <rect x="255" y="90" width="40" height="130" fill="currentColor" opacity="0.45" rx="2" />
        {/* Sun */}
        <circle cx="240" cy="55" r="22" fill="oklch(0.85 0.18 70)" opacity="0.7" />
      </svg>
      {/* Itinerary card overlay */}
      <div className="relative z-10 w-[80%] rounded-xl border border-muted/20 bg-background/95 p-4 shadow-lg backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand">Day 1 · Goa</p>
        <ul className="mt-2 space-y-1.5 text-sm">
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Sunrise at Anjuna Beach
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Brunch at a hidden Goan kitchen
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Old Goa basilicas walking tour
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Sunset cruise on the Mandovi
          </li>
        </ul>
        <p className="mt-3 text-[11px] text-muted">☀ 28°C · 🚖 ₹350 avg · ⚠ low scam zone</p>
      </div>
    </div>
  );
}
