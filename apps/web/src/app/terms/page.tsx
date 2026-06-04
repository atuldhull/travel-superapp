/**
 * POST.6 — Terms of Service. Server component; reads the placeholder
 * MD source from `docs/legal/terms.md` and renders it via the tiny
 * inline converter. Counsel review pending — see the badge.
 *
 * Restyled into the v2 ("Fusion") design language (royal/gold tokens,
 * font-display, cinematic header band) — the markdown body still comes
 * straight from `renderLegalMarkdown`.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ScrollText } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';
import { renderLegalMarkdown } from '../../lib/render-legal-markdown';

export const metadata: Metadata = {
  title: 'Terms of Service · TravelSuperApp',
  description: 'The rules for using TravelSuperApp.',
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  const { html, lastUpdated } = renderLegalMarkdown('terms');
  return (
    <main className="space-y-8">
      <Link
        href={'/' as never}
        className="inline-flex items-center gap-1.5 text-sm text-muted outline-none transition hover:text-gold-600 focus-visible:ring-2 focus-visible:ring-gold-500/40"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back home
      </Link>

      {/* Cinematic royal header band — matches /home + /trips. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <ScrollText aria-hidden className="h-3.5 w-3.5" /> The fine print
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Terms of Service
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          The rules for using TravelSuperApp.
        </p>
        <div className="relative mt-4 flex flex-wrap items-center gap-2 text-xs text-white/65">
          <span>Last updated: {lastUpdated}</span>
          <span aria-hidden>·</span>
          <span title="Placeholder draft — replace with counsel-reviewed copy before production.">
            <Badge variant="gold" className="border border-gold-500/40">
              Counsel review pending
            </Badge>
          </span>
        </div>
      </header>

      <Card depth="raised" className="max-w-3xl">
        <div
          // Server-rendered HTML, escaped at the source by renderLegalMarkdown.
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </Card>
    </main>
  );
}
