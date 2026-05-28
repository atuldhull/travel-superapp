/**
 * /aether/plan — the trip-planner entry surface (Phase 0 stub).
 *
 * The form submits to a local state-only handler; Phase 1 wires this
 * to the existing trip-planner backend (POST /trips/draft).
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PlanLazy } from '@/components/aether/plan/plan-lazy';
import { aetherOg } from '@/lib/aether-og';

const TITLE = 'Aether · Begin a yatra';
const DESC = 'Three questions, one sketched journey.';
export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  robots: { index: false, follow: false },
  ...aetherOg(TITLE, DESC, { photoId: '1599661046289-e31897846e41' }),
};

export default function PlanRoute(): React.ReactElement {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    notFound();
  }
  return <PlanLazy />;
}
