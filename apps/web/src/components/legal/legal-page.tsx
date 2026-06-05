/**
 * POST.6 — Shared frame for /terms, /privacy, /cookies. Renders the
 * MD body inside a max-w-3xl article, prepends a "Last updated +
 * Counsel review pending" badge row, and supplies a back link.
 *
 * Server component on purpose — no client JS needed for legal text.
 */
import Link from 'next/link';

export interface LegalPageProps {
  readonly title: string;
  readonly lastUpdated: string;
  readonly html: string;
}

export function LegalPage({ title, lastUpdated, html }: LegalPageProps) {
  return (
    <article className="space-y-4">
      <header className="space-y-2">
        <Link href={'/' as never} className="text-xs text-muted underline-offset-2 hover:underline">
          ← Back home
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Last updated: {lastUpdated}</span>
          <span aria-hidden>·</span>
          <span
            className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300"
            title="Placeholder draft — replace with counsel-reviewed copy before production."
          >
            ⚠️ Counsel review pending
          </span>
        </div>
      </header>
      <div
        // Server-rendered HTML, escaped at the source by renderLegalMarkdown.

        dangerouslySetInnerHTML={{ __html: html }}
      />
    </article>
  );
}
