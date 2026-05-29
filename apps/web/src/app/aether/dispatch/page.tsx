/**
 * /aether/dispatch — admin-only Aether ops view.
 *
 * Surfaces aggregate metrics across the Aether preview: total trips,
 * drafts, archived, share-codes-active. Phase 0 client-side roll-up
 * (admins are few; one round-trip per signed-in admin is fine).
 * Phase 1 swaps to a dedicated /admin/aether-metrics endpoint with
 * a SQL aggregation.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { DispatchLazy } from '@/components/aether/dispatch/dispatch-lazy';
import { aetherOg } from '@/lib/aether-og';

const TITLE = 'Aether · Dispatch';
const DESC = 'Aether ops — aggregate metrics for the preview surface.';
export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  robots: { index: false, follow: false },
  ...aetherOg(TITLE, DESC),
};

export default function DispatchRoute(): React.ReactElement {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    notFound();
  }
  return <DispatchLazy />;
}
