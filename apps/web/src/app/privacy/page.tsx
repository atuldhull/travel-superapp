/**
 * POST.6 — Privacy Policy. Server component; reads
 * `docs/legal/privacy.md` and renders it via the tiny inline
 * converter. Counsel review pending — see the badge.
 *
 * Restyled into the v2 ("Fusion") design language (royal/gold tokens,
 * font-display, cinematic header band, raised legal-body card). The
 * shared <LegalPage> frame stays in place for /terms + /cookies; this
 * surface composes the same rendered markdown inline so it can carry
 * the royal header without touching that shared component.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';
import { renderLegalMarkdown } from '../../lib/render-legal-markdown';

export const metadata: Metadata = {
  title: 'Privacy Policy · TravelSuperApp',
  description: 'What data we collect, how we use it, and your rights.',
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  const { html, lastUpdated } = renderLegalMarkdown('privacy');
  return (
    <main className="space-y-8">
      <Link
        href={'/' as never}
        className="inline-flex items-center gap-1.5 text-sm text-muted underline-offset-4 transition hover:text-gold-600 hover:underline"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Back home
      </Link>

      {/* Cinematic royal header band — matches /trips + /account. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <ShieldCheck aria-hidden className="h-3.5 w-3.5" /> Your data, your rights
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Privacy Policy
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          What data we collect, how we use it, and the controls you have over it.
        </p>
      </header>

      <Card depth="raised" className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Last updated: {lastUpdated}</span>
          <span aria-hidden>·</span>
          <Badge
            variant="gold"
            className="text-[10px]"
            // Placeholder draft — replace with counsel-reviewed copy before production.
          >
            ⚠️ Counsel review pending
          </Badge>
        </div>
        <div
          // Server-rendered HTML, escaped at the source by renderLegalMarkdown.
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </Card>
    </main>
  );
}
