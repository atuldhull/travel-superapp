/**
 * /aether/plan — the trip-planner entry surface (Phase 0 stub).
 *
 * The form submits to a local state-only handler; Phase 1 wires this
 * to the existing trip-planner backend (POST /trips/draft).
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PlanLazy } from '@/components/aether/plan/plan-lazy';

export const metadata: Metadata = {
  title: 'Aether · Begin a yatra',
  description: 'Three questions, one sketched journey.',
  robots: { index: false, follow: false },
};

export default function PlanRoute(): React.ReactElement {
  if (process.env['NEXT_PUBLIC_FEATURE_AETHER_PREVIEW'] !== '1') {
    notFound();
  }
  return <PlanLazy />;
}
