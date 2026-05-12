/**
 * POST.6 — Cookie Policy. Server component; reads
 * `docs/legal/cookies.md` and renders it via the tiny inline
 * converter. Counsel review pending — see the badge.
 */
import type { Metadata } from 'next';
import { LegalPage } from '../../components/legal/legal-page';
import { renderLegalMarkdown } from '../../lib/render-legal-markdown';

export const metadata: Metadata = {
  title: 'Cookie Policy · TravelSuperApp',
  description: 'Which cookies we set and why.',
  robots: { index: true, follow: true },
};

export default function CookiesPage() {
  const { html, lastUpdated } = renderLegalMarkdown('cookies');
  return <LegalPage title="Cookie Policy" lastUpdated={lastUpdated} html={html} />;
}
