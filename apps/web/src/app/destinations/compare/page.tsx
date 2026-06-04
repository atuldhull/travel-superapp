/**
 * /destinations/compare — shareable side-by-side of two destination
 * guides (?a=<slug>&b=<slug>). Server shell + a Suspense boundary
 * around the client compare (it reads useSearchParams).
 */
import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, GitCompareArrows } from 'lucide-react';
import { DestinationsCompare } from '../../../components/v2/destinations-compare';

const TITLE = 'Compare destinations · TravelSuperApp';
const DESC = 'Put two destinations head to head — seasons, pace, budget and the case for each.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
};

export default function CompareDestinationsPage(): React.ReactElement {
  return (
    <main className="space-y-8">
      <Link
        href="/destinations"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-gold-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> All destinations
      </Link>

      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <GitCompareArrows aria-hidden className="h-3.5 w-3.5" /> Head to head
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Compare destinations
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Torn between two places? Put them side by side — season, pace, budget and the case for
          each. Share the link to settle it.
        </p>
      </header>

      <Suspense fallback={<p className="text-sm text-muted">Loading comparison…</p>}>
        <DestinationsCompare />
      </Suspense>
    </main>
  );
}
