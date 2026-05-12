/**
 * POST.2 — landing hero (rewrite).
 *
 * Two-column layout (collapses to single on mobile):
 *   left  — eyebrow pill + 3-line headline + 1-line elaboration
 *           + dual CTA + trust line
 *   right — /illustrations/hero.svg (mountains + route arc + paper
 *           plane + an itinerary card overlay)
 *
 * Server Component. No client interactivity. Tailwind only — no
 * keyframe animation, so the entire fold renders before hydration.
 *
 * Replaces V.UX.1's CSS-skyline + dummy-itinerary-card. The new
 * SVG is exported from /public/illustrations/hero.svg (~6 KB) and
 * loaded as <Image>; this keeps brand consistency on every reload
 * and improves LCP (decoded image vs CSS gradient + JS).
 */
import Image from 'next/image';
import Link from 'next/link';

export function LandingHero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden rounded-2xl border border-muted/15 bg-linear-to-br from-brand-50 via-surface to-amber-50 px-6 py-12 shadow-(--shadow-depth-2) dark:from-brand-900/30 dark:via-surface dark:to-amber-900/10 sm:px-10 sm:py-16"
    >
      <div className="relative z-10 grid items-center gap-10 sm:grid-cols-[1.1fr_1fr]">
        {/* Left: copy + CTAs */}
        <div className="space-y-5">
          <p className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
            <span aria-hidden>✦</span>
            <span>AI-powered travel companion</span>
          </p>
          <h1
            id="hero-heading"
            className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl"
          >
            Plan, explore,
            <br />
            stay safe — <span className="text-brand">anywhere you go.</span>
          </h1>
          <p className="max-w-md text-base leading-relaxed text-muted sm:text-lg">
            Type a city. Get a full itinerary in seconds. Live safety, weather, and crowd data built
            in. No spreadsheets. No 40 tabs.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <a
              href="#sample-trip"
              className="inline-flex items-center gap-1.5 rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-(--shadow-depth-2) transition hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-(--shadow-depth-3) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              See a sample trip <span aria-hidden>↓</span>
            </a>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-md border border-brand/40 px-5 py-2.5 text-sm font-semibold text-brand transition hover:-translate-y-0.5 hover:border-brand/70 hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              Sign up free
            </Link>
          </div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Open-source
            </span>
            <span className="text-muted/40">·</span>
            <span>GDPR / DPDP compliant</span>
            <span className="text-muted/40">·</span>
            <span>No card to try</span>
          </p>
        </div>

        {/* Right: illustration */}
        <div className="relative mx-auto w-full max-w-md">
          <Image
            src="/illustrations/hero.svg"
            alt="Stylised travel scene with mountains, route arc, paper plane, and an itinerary card"
            width={480}
            height={360}
            priority
            className="h-auto w-full drop-shadow-(--shadow-depth-3)"
          />
        </div>
      </div>
    </section>
  );
}
