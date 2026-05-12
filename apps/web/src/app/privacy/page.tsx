/**
 * POST.6 — Privacy Policy. Server component; reads
 * `docs/legal/privacy.md` and renders it via the tiny inline
 * converter. Counsel review pending — see the badge.
 */
import type { Metadata } from 'next';
import { LegalPage } from '../../components/legal/legal-page';
import { renderLegalMarkdown } from '../../lib/render-legal-markdown';

export const metadata: Metadata = {
  title: 'Privacy Policy · TravelSuperApp',
  description: 'What data we collect, how we use it, and your rights.',
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  const { html, lastUpdated } = renderLegalMarkdown('privacy');
  return <LegalPage title="Privacy Policy" lastUpdated={lastUpdated} html={html} />;
}
