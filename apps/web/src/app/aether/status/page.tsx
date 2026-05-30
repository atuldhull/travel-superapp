/**
 * /aether/status — operator-facing health page.
 *
 * Visible on production once the env gate flips. Useful for:
 *   • Confirming the deploy actually picked up the latest commit.
 *   • Checking the feature-flag state in one place.
 *   • Watching the api /health/ready endpoint succeed/fail.
 *   • Knowing which routes exist + counts.
 *
 * Pulls the api status via the same `apiFetch` chain Pulse uses,
 * so reachability matches what users would see.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { StatusLazy } from '@/components/aether/status/status-lazy';
import { aetherOg } from '@/lib/aether-og';

const TITLE = 'Aether · Status';
const DESC = 'Aether health: feature flag · api reachability · route counts.';
export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  robots: { index: false, follow: false },
  ...aetherOg(TITLE, DESC),
};

export default function StatusRoute(): React.ReactElement {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    notFound();
  }
  return <StatusLazy />;
}
