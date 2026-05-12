/**
 * POST.6 — Terms of Service. Server component; reads the placeholder
 * MD source from `docs/legal/terms.md` and renders it via the tiny
 * inline converter. Counsel review pending — see the badge.
 */
import type { Metadata } from 'next';
import { LegalPage } from '../../components/legal/legal-page';
import { renderLegalMarkdown } from '../../lib/render-legal-markdown';

export const metadata: Metadata = {
  title: 'Terms of Service · TravelSuperApp',
  description: 'The rules for using TravelSuperApp.',
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  const { html, lastUpdated } = renderLegalMarkdown('terms');
  return <LegalPage title="Terms of Service" lastUpdated={lastUpdated} html={html} />;
}
